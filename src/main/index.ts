import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type { AppSnapshot, ConversionFormat, HistoryQuery, MediaMode, Preferences, SessionService, Task } from '../shared/types'
import { Store } from './store'
import { Sessions } from './sessions'
import { SessionPairing } from './session-pairing'
import { MediaEngine } from './engine'
import { Downloads } from './downloads'

let window: BrowserWindow | null = null
let store: Store
let sessions: Sessions
let pairing: SessionPairing
let engine: MediaEngine
let downloads: Downloads
let engineState: AppSnapshot['engine'] = 'starting'
let engineError = ''
const startedAt = Date.now()
let startupMs: number | null = null
const smokeTransferSamples: Array<{ received: number; total: number | null; kind: Task['totalKind']; fraction: number | null }> = []
let pendingConversion: { token: string; inputPath: string } | null = null
const smokeDirectory = process.argv.includes('--nib-smoke') ? process.env.NIB_SMOKE_DIR : undefined
if (smokeDirectory) { mkdirSync(smokeDirectory, { recursive: true }); app.setPath('userData', smokeDirectory) }

function snapshot(): AppSnapshot {
  return {
    tasks: store.activeTasks(),
    history: store.history({ limit: 50 }).items,
    preferences: store.getPreferences(), sessions: sessions.status(), engine: engineState, engineError, appVersion: app.getVersion(), extractorVersion: engine.version
  }
}
function publish(): void { if (window && !window.isDestroyed()) window.webContents.send('nib:snapshot', snapshot()) }
function publishTask(task: Task): void {
  if (smokeDirectory && task.state === 'transferring' && smokeTransferSamples.length < 100) {
    smokeTransferSamples.push({ received: task.bytesReceived, total: task.bytesTotal, kind: task.totalKind, fraction: task.progress })
  }
  if (!window || window.isDestroyed()) return
  window.webContents.send('nib:task', task)
  if (task.state === 'completed') publish()
}
function createWindow(): void {
  window = new BrowserWindow({
    width: 1380, height: 820, minWidth: 920, minHeight: 620, show: !smokeDirectory || process.env.NIB_CAPTURE_SCENES === '1',
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
  handle('nib:task-action', (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry' | 'remove') => downloads.action(id, action))
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
    publish()
  })
  handle('nib:clear-session', async (service: SessionService) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.clear(service); publish()
  })
  handle('nib:begin-session-pairing', (service: SessionService) => pairing.begin(service))
  handle('nib:open-extension-folder', async () => {
    const directory = app.isPackaged ? join(process.resourcesPath, 'extension') : join(app.getAppPath(), 'extension')
    const error = await shell.openPath(directory)
    if (error) throw new Error(error)
  })
  handle('nib:update-engine', async () => {
    if (downloads.busy()) throw new Error('Wait for active downloads before updating the extractor')
    const version = await engine.update(); publish(); return version
  })
  handle('nib:clear-history', () => { store.clearHistory(); publish() })
  handle('nib:open-path', async (path: string, folder: boolean) => {
    const allowed = store.tasks().some(t => t.state === 'completed' && t.outputPath === path)
    if (!allowed) throw new Error('File is not in your history')
    if (folder) shell.showItemInFolder(path)
    else { const error = await shell.openPath(path); if (error) throw new Error(error) }
  })
  handle('nib:pick-conversion-file', async () => {
    const picked = await dialog.showOpenDialog(window!, { properties: ['openFile'], filters: [{ name: 'Media', extensions: ['mp4','mkv','mov','webm','m4a','mp3','aac','ogg','wav'] }] })
    if (picked.canceled) return null
    pendingConversion = { token: randomUUID(), inputPath: picked.filePaths[0] }
    return { token: pendingConversion.token, name: basename(pendingConversion.inputPath) }
  })
  handle('nib:convert-file', (token: string, format: ConversionFormat) => {
    if (!['mp4', 'mkv', 'mp3', 'wav'].includes(format)) throw new Error('Choose an output format')
    if (!pendingConversion || pendingConversion.token !== token) throw new Error('Choose a file first')
    const input = pendingConversion.inputPath
    pendingConversion = null
    return downloads.convert(input, format)
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
  if (smokeDirectory) store.setPreferences({ ...store.getPreferences(), downloadDirectory: join(directory, 'downloads'), tutorialSeenVersion: 2 })
  sessions = new Sessions(directory)
  pairing = new SessionPairing((service, cookies) => {
    if (downloads.busy()) throw new Error('Wait for active downloads before changing sessions')
    sessions.importBrowser(service, cookies)
    publish()
  })
  engine = new MediaEngine(directory)
  downloads = new Downloads(store, engine, sessions, publishTask, publish)
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
      const browserPair = await pairing.begin('youtube')
      const browserResponse = await fetch(`http://127.0.0.1:${browserPair.port}/session`, {
        method: 'POST',
        headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'youtube', code: browserPair.code, cookies: [{ domain: '.youtube.com', path: '/', name: 'NIB_TEST', value: 'synthetic', secure: true, httpOnly: true }] })
      })
      const browserCookieFile = join(directory, 'browser-smoke-cookies.txt')
      if (!browserResponse.ok || !sessions.status().youtube || !sessions.materializeFor('https://www.youtube.com/watch?v=test', browserCookieFile) || !readFileSync(browserCookieFile, 'utf8').includes('NIB_TEST')) throw new Error('Browser session import failed')
      rmSync(browserCookieFile, { force: true })
      sessions.clear('youtube')
      report.browserSession = { imported: true, cleared: !sessions.status().youtube }
      if (process.env.NIB_CAPTURE_SCENES === '1') {
        report.layout = await window!.webContents.executeJavaScript("({ viewport: innerWidth, wordmark: document.querySelector('.hero-logo-frame')?.getBoundingClientRect().width })")
        for (const [name, index] of [['home', 0], ['downloads', 1], ['history', 2], ['settings', 3]] as const) {
          if (index) await window!.webContents.executeJavaScript(`document.querySelectorAll('nav button')[${index}].click()`)
          await new Promise(resolve => setTimeout(resolve, 900))
          await writeFile(join(directory, `smoke-${name}.png`), (await window!.capturePage()).toPNG())
        }
        await window!.webContents.executeJavaScript("document.querySelector('.help-block .path-button').click()")
        for (let step = 1; step < 5; step++) {
          await new Promise(resolve => setTimeout(resolve, 450))
          await window!.webContents.executeJavaScript("document.querySelector('.tour-card button.primary').click()")
        }
        await new Promise(resolve => setTimeout(resolve, 900))
        await writeFile(join(directory, 'smoke-tour-sessions.png'), (await window!.capturePage()).toPNG())
        await window!.webContents.executeJavaScript("document.querySelector('.tour-card button:first-child').click()")
        await new Promise(resolve => setTimeout(resolve, 500))
        window!.setSize(920, 620)
        await window!.webContents.executeJavaScript("document.querySelectorAll('nav button')[0].click()")
        await new Promise(resolve => setTimeout(resolve, 900))
        await writeFile(join(directory, 'smoke-home-small.png'), (await window!.capturePage()).toPNG())
      }
      const sources = [
        { name: 'youtube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
        { name: 'streamable', url: 'https://streamable.com/p9cln4' }
      ]
      const attempts: Array<{ mode: MediaMode; source: string; code: string }> = []
      report.attempts = attempts
      for (const mode of ['video', 'audio'] as const) {
        for (const source of sources) {
          const id = downloads.submit(source.url, mode)
          const deadline = Date.now() + 120_000
          let task: Task | undefined
          do {
            task = store.getTask(id)
            if (task?.state === 'completed' || task?.state === 'failed') break
            await new Promise(resolve => setTimeout(resolve, 250))
          } while (Date.now() < deadline)
          if (task?.state === 'completed' && task.outputPath && existsSync(task.outputPath)) {
            report[mode] = { source: source.name, bytes: task.bytesReceived, mediaType: task.mediaType }
            break
          }
          const code = task?.errorCode || task?.state || 'timeout'
          attempts.push({ mode, source: source.name, code })
          if (task && task.state !== 'failed') downloads.action(id, 'cancel')
        }
        if (!report[mode]) throw new Error(`${mode} failed: ${attempts.filter(attempt => attempt.mode === mode).map(attempt => `${attempt.source}:${attempt.code}`).join(', ')}`)
      }
      report.transferSamples = smokeTransferSamples
      const input = join(directory, 'conversion-smoke.wav')
      const pcm = Buffer.alloc(3200)
      const header = Buffer.alloc(44)
      header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8)
      header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
      header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28)
      header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
      header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
      await writeFile(input, Buffer.concat([header, pcm]))
      const conversionId = downloads.convert(input, 'wav')
      const conversionDeadline = Date.now() + 30_000
      let conversion: Task | undefined
      do {
        conversion = store.getTask(conversionId)
        if (conversion?.state === 'completed' || conversion?.state === 'failed') break
        await new Promise(resolve => setTimeout(resolve, 100))
      } while (Date.now() < conversionDeadline)
      if (conversion?.state !== 'completed' || !conversion.outputPath || !existsSync(conversion.outputPath) || !existsSync(input)) throw new Error(`Conversion failed: ${conversion?.errorCode || conversion?.state}`)
      report.conversion = { bytes: conversion.bytesReceived }
      report.ok = true
    } catch (error) { report.ok = false; report.failure = String(error) }
    await writeFile(join(directory, 'smoke-report.json'), JSON.stringify(report, null, 2), 'utf8')
    engine.stop(); store.close(); app.exit(report.ok ? 0 : 1)
  }
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { pairing?.stop(); engine?.stop(); store?.close() })
