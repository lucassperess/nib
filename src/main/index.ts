import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, dirname, extname, parse } from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { AppSnapshot, ConversionFormat, MediaMode, Preferences, SessionService } from '../shared/types'
import { Store } from './store'
import { Sessions } from './sessions'
import { CobaltEngine } from './engine'
import { Downloads } from './downloads'

let window: BrowserWindow | null = null
let store: Store
let sessions: Sessions
let engine: CobaltEngine
let downloads: Downloads
let engineState: AppSnapshot['engine'] = 'starting'
let engineError = ''

function snapshot(): AppSnapshot {
  const tasks = store.tasks()
  return {
    tasks: tasks.filter(t => t.state !== 'completed'),
    history: tasks.filter(t => t.state === 'completed').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    preferences: store.getPreferences(), sessions: sessions.status(), engine: engineState, engineError
  }
}
function publish(): void { if (window && !window.isDestroyed()) window.webContents.send('nib:snapshot', snapshot()) }
function ffmpegPath(): string {
  const cobalt = engine.root
  const binary = join(cobalt, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
  return existsSync(binary) ? binary : 'ffmpeg'
}
function createWindow(): void {
  window = new BrowserWindow({
    width: 1380, height: 820, minWidth: 920, minHeight: 620,
    backgroundColor: '#100b20', title: 'Nib', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), nodeIntegration: false, contextIsolation: true, sandbox: false }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
  window.webContents.once('did-finish-load', publish)
}
function registerIpc(): void {
  ipcMain.handle('nib:snapshot', () => snapshot())
  ipcMain.handle('nib:submit', (_event, url: string, mode: MediaMode) => {
    if (engineState !== 'ready') throw new Error('The local engine is still starting')
    if (mode !== 'video' && mode !== 'audio') throw new Error('Choose video or audio')
    return downloads.submit(url, mode)
  })
  ipcMain.handle('nib:select', (_event, id: string, indexes: number[]) => downloads.select(id, indexes))
  ipcMain.handle('nib:task-action', (_event, id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => downloads.action(id, action))
  ipcMain.handle('nib:set-preferences', (_event, patch: Partial<Preferences>) => {
    const current = store.getPreferences()
    const next: Preferences = {
      downloadDirectory: typeof patch.downloadDirectory === 'string' && patch.downloadDirectory ? patch.downloadDirectory : current.downloadDirectory,
      videoQuality: ['max','2160','1440','1080','720','480'].includes(String(patch.videoQuality)) ? patch.videoQuality! : current.videoQuality,
      audioFormat: ['best','mp3','ogg','wav','opus'].includes(String(patch.audioFormat)) ? patch.audioFormat! : current.audioFormat,
      reducedMotion: typeof patch.reducedMotion === 'boolean' ? patch.reducedMotion : current.reducedMotion
    }
    store.setPreferences(next); publish(); return next
  })
  ipcMain.handle('nib:choose-directory', async () => {
    const result = await dialog.showOpenDialog(window!, { properties: ['openDirectory', 'createDirectory'], defaultPath: store.getPreferences().downloadDirectory })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('nib:import-session', async (_event, service: SessionService, cookie: string) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.import(service, cookie)
    engineState = 'starting'; publish()
    try { await engine.restart(); engineState = 'ready'; engineError = '' }
    catch (error) { engineState = 'error'; engineError = String(error) }
    publish()
  })
  ipcMain.handle('nib:clear-session', async (_event, service: SessionService) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.clear(service); engineState = 'starting'; publish()
    try { await engine.restart(); engineState = 'ready'; engineError = '' }
    catch (error) { engineState = 'error'; engineError = String(error) }
    publish()
  })
  ipcMain.handle('nib:clear-history', () => { store.clearHistory(); publish() })
  ipcMain.handle('nib:open-path', async (_event, path: string, folder: boolean) => {
    const allowed = store.tasks().some(t => t.state === 'completed' && t.outputPath === path)
    if (!allowed) throw new Error('File is not in your history')
    if (folder) shell.showItemInFolder(path)
    else { const error = await shell.openPath(path); if (error) throw new Error(error) }
  })
  ipcMain.handle('nib:convert-file', async (_event, format: ConversionFormat) => {
    if (!['mp4', 'mkv', 'mp3', 'wav'].includes(format)) throw new Error('Choose an output format')
    const picked = await dialog.showOpenDialog(window!, { properties: ['openFile'], filters: [{ name: 'Media', extensions: ['mp4','mkv','mov','webm','m4a','mp3','aac','ogg'] }] })
    if (picked.canceled) return null
    const input = picked.filePaths[0], parsed = parse(input)
    let output = join(dirname(input), `${parsed.name}-converted.${format}`)
    if (existsSync(output)) output = join(dirname(input), `${parsed.name}-converted-${randomUUID().slice(0, 6)}.${format}`)
    const run = (options: string[]) => new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegPath(), ['-hide_banner', '-n', '-i', input, ...options, output], { windowsHide: true })
      let error = ''
      child.stderr?.on('data', chunk => { error = (error + String(chunk)).slice(-800) })
      child.once('error', reject)
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`Could not convert this file: ${error}`)))
    })
    const sameFormat = extname(input).toLowerCase() === `.${format}`
    if (sameFormat) { await run(['-map', '0', '-c', 'copy']); return { path: output, method: 'copy' } }
    if (format === 'mp4' || format === 'mkv') {
      try { await run(['-map', '0', '-c', 'copy']); return { path: output, method: 'copy' } }
      catch { rmSync(output, { force: true }); await run(['-c:v', 'libx264', '-c:a', 'aac']); return { path: output, method: 'converted' } }
    }
    await run(format === 'mp3' ? ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'] : ['-vn', '-c:a', 'pcm_s16le'])
    return { path: output, method: 'converted' }
  })
}

app.whenReady().then(async () => {
  app.setAppUserModelId('dev.nib.desktop')
  const directory = app.getPath('userData')
  store = new Store(directory, app.getPath('downloads'))
  sessions = new Sessions(directory)
  engine = new CobaltEngine(sessions, directory)
  downloads = new Downloads(store, engine, publish, ffmpegPath())
  registerIpc(); createWindow()
  try { await engine.start(); engineState = 'ready'; engineError = ''; downloads.pump() }
  catch (error) { engineState = 'error'; engineError = String(error) }
  publish()
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { engine?.stop(); store?.close() })
