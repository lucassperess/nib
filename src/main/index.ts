import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, dirname, extname, parse } from 'node:path'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type { AppSnapshot, ConversionFormat, HistoryQuery, MediaMode, Preferences, SessionService, Task } from '../shared/types'
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
const startedAt = Date.now()
let startupMs: number | null = null
const smokeDirectory = process.argv.includes('--nib-smoke') ? process.env.NIB_SMOKE_DIR : undefined
if (smokeDirectory) { mkdirSync(smokeDirectory, { recursive: true }); app.setPath('userData', smokeDirectory) }

function snapshot(): AppSnapshot {
  return {
    tasks: store.activeTasks(),
    history: store.history({ limit: 50 }).items,
    preferences: store.getPreferences(), sessions: sessions.status(), engine: engineState, engineError, appVersion: app.getVersion()
  }
}
function publish(): void { if (window && !window.isDestroyed()) window.webContents.send('nib:snapshot', snapshot()) }
function publishTask(task: Task): void {
  if (!window || window.isDestroyed()) return
  window.webContents.send('nib:task', task)
  if (task.state === 'completed') publish()
}
function ffmpegPath(): string {
  const cobalt = engine.root
  const binary = join(cobalt, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
  return existsSync(binary) ? binary : 'ffmpeg'
}
function createWindow(): void {
  window = new BrowserWindow({
    width: 1380, height: 820, minWidth: 920, minHeight: 620, show: !smokeDirectory,
    backgroundColor: '#100b20', title: 'Nib', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
  window.webContents.once('did-finish-load', publish)
}
function registerIpc(): void {
  const handle = (channel: string, callback: (...args: any[]) => unknown) => ipcMain.handle(channel, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted window')
    return callback(...args)
  })
  handle('nib:snapshot', () => snapshot())
  handle('nib:history', (query: HistoryQuery) => store.history(query || {}))
  handle('nib:submit', (url: string, mode: MediaMode) => {
    if (engineState !== 'ready') throw new Error('The local engine is still starting')
    if (mode !== 'video' && mode !== 'audio') throw new Error('Choose video or audio')
    return downloads.submit(url, mode)
  })
  handle('nib:select', (id: string, indexes: number[]) => downloads.select(id, indexes))
  handle('nib:task-action', (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => downloads.action(id, action))
  handle('nib:set-preferences', (patch: Partial<Preferences>) => {
    const current = store.getPreferences()
    const next: Preferences = {
      downloadDirectory: typeof patch.downloadDirectory === 'string' && patch.downloadDirectory ? patch.downloadDirectory : current.downloadDirectory,
      videoQuality: ['max','2160','1440','1080','720','480'].includes(String(patch.videoQuality)) ? patch.videoQuality! : current.videoQuality,
      audioFormat: ['best','mp3','ogg','wav','opus'].includes(String(patch.audioFormat)) ? patch.audioFormat! : current.audioFormat,
      reducedMotion: typeof patch.reducedMotion === 'boolean' ? patch.reducedMotion : current.reducedMotion,
      locale: ['system', 'pt-BR', 'en'].includes(String(patch.locale)) ? patch.locale! : current.locale,
      tutorialSeenVersion: Number.isInteger(patch.tutorialSeenVersion) && patch.tutorialSeenVersion! >= 0 ? patch.tutorialSeenVersion! : current.tutorialSeenVersion
    }
    store.setPreferences(next); publish(); return next
  })
  handle('nib:choose-directory', async () => {
    const result = await dialog.showOpenDialog(window!, { properties: ['openDirectory', 'createDirectory'], defaultPath: store.getPreferences().downloadDirectory })
    return result.canceled ? null : result.filePaths[0]
  })
  handle('nib:import-session', async (service: SessionService, cookie: string) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.import(service, cookie)
    engineState = 'starting'; publish()
    try { await engine.restart(); engineState = 'ready'; engineError = '' }
    catch (error) { engineState = 'error'; engineError = String(error) }
    publish()
  })
  handle('nib:clear-session', async (service: SessionService) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.clear(service); engineState = 'starting'; publish()
    try { await engine.restart(); engineState = 'ready'; engineError = '' }
    catch (error) { engineState = 'error'; engineError = String(error) }
    publish()
  })
  handle('nib:clear-history', () => { store.clearHistory(); publish() })
  handle('nib:open-path', async (path: string, folder: boolean) => {
    const allowed = store.tasks().some(t => t.state === 'completed' && t.outputPath === path)
    if (!allowed) throw new Error('File is not in your history')
    if (folder) shell.showItemInFolder(path)
    else { const error = await shell.openPath(path); if (error) throw new Error(error) }
  })
  handle('nib:convert-file', async (format: ConversionFormat) => {
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
  handle('nib:open-releases', () => shell.openExternal('https://github.com/lucassperess/nib/releases'))
  handle('nib:restart-engine', async () => {
    if (downloads.busy()) throw new Error('Wait for active downloads')
    engineState = 'starting'; publish()
    try { await engine.restart(); engineState = 'ready'; engineError = ''; downloads.pump() }
    catch (error) { engineState = 'error'; engineError = String(error) }
    publish()
  })
  handle('nib:export-diagnostics', async () => {
    const result = await dialog.showSaveDialog(window!, { defaultPath: `nib-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePath) return null
    const counts: Record<string, number> = {}
    const errors: Record<string, number> = {}
    for (const task of store.tasks()) {
      counts[task.state] = (counts[task.state] || 0) + 1
      if (task.errorCode) {
        const code = /^[a-zA-Z0-9._-]{1,80}$/.test(task.errorCode) ? task.errorCode : 'unknown'
        errors[code] = (errors[code] || 0) + 1
      }
    }
    const report = { appVersion: app.getVersion(), platform: process.platform, arch: process.arch, osRelease: process.getSystemVersion(), engine: engineState, startupMs, tasksByState: counts, errorsByCode: errors, generatedAt: new Date().toISOString() }
    await writeFile(result.filePath, JSON.stringify(report, null, 2), 'utf8')
    return result.filePath
  })
}

app.whenReady().then(async () => {
  app.setAppUserModelId('dev.nib.desktop')
  const directory = app.getPath('userData')
  store = new Store(directory, app.getPath('downloads'))
  if (smokeDirectory) store.setPreferences({ ...store.getPreferences(), downloadDirectory: join(directory, 'downloads'), tutorialSeenVersion: 1 })
  sessions = new Sessions(directory)
  engine = new CobaltEngine(sessions, directory)
  downloads = new Downloads(store, engine, publishTask, ffmpegPath(), publish)
  registerIpc(); createWindow()
  const rendererLoaded = new Promise<void>((resolve, reject) => {
    window!.webContents.once('did-finish-load', () => resolve())
    window!.webContents.once('did-fail-load', (_event, code, description) => reject(new Error(`Renderer ${code}: ${description}`)))
  })
  try { await engine.start(); startupMs = Date.now() - startedAt; engineState = 'ready'; engineError = ''; downloads.pump() }
  catch (error) { engineState = 'error'; engineError = String(error) }
  publish()
  if (smokeDirectory) {
    const report: Record<string, unknown> = { version: app.getVersion(), startupMs, engine: engineState }
    try {
      if (engineState !== 'ready') throw new Error(engineError || 'Engine did not start')
      await rendererLoaded
      const bridge = await window!.webContents.executeJavaScript('window.nib.snapshot().then(s => ({ version: s.appVersion, engine: s.engine }))')
      if (bridge.version !== app.getVersion() || bridge.engine !== 'ready') throw new Error('Sandboxed preload bridge failed')
      report.bridge = bridge
      for (const mode of ['video', 'audio'] as const) {
        const id = downloads.submit('https://www.youtube.com/watch?v=jNQXAC9IVRw', mode)
        const deadline = Date.now() + 120_000
        let task: Task | undefined
        do {
          task = store.getTask(id)
          if (task?.state === 'completed' || task?.state === 'failed') break
          await new Promise(resolve => setTimeout(resolve, 250))
        } while (Date.now() < deadline)
        if (task?.state !== 'completed' || !task.outputPath || !existsSync(task.outputPath)) {
          const detail = (task?.error || '').replace(/https?:\/\/\S+/g, '[url]').replace(/[A-Z]:\\[^\s]+/gi, '[path]').slice(0, 400)
          throw new Error(`${mode} failed: ${task?.errorCode || task?.state || 'timeout'}${detail ? ` (${detail})` : ''}`)
        }
        report[mode] = { bytes: task.bytesReceived, mediaType: task.mediaType }
      }
      report.ok = true
    } catch (error) { report.ok = false; report.failure = String(error) }
    await writeFile(join(directory, 'smoke-report.json'), JSON.stringify(report, null, 2), 'utf8')
    engine.stop(); store.close(); app.exit(report.ok ? 0 : 1)
  }
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { engine?.stop(); store?.close() })
