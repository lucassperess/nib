import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { constants, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { copyFile, stat } from 'node:fs/promises'
import { basename, extname, join, parse } from 'node:path'
import { once } from 'node:events'
import type { MediaMode, PickerItem, Task } from '../shared/types'
import { Store } from './store'
import { CobaltEngine } from './engine'

type CobaltResponse =
  | { status: 'redirect' | 'tunnel'; url: string; filename?: string }
  | { status: 'picker'; picker: PickerItem[] }
  | { status: 'local-processing'; type: string; tunnel: string[]; output: { filename: string; type: string }; audio?: { copy: boolean; format: string; bitrate: string } }
  | { status: 'error'; error: { code: string; context?: Record<string, unknown> } }

type Control = { abort: AbortController; paused: boolean; wake?: () => void; process?: ChildProcess; canceled: boolean }
class DownloadError extends Error { constructor(readonly code: string, message: string) { super(message) } }
const errorCode = (error: unknown): string => {
  if (error instanceof DownloadError) return error.code
  const code = (error as NodeJS.ErrnoException)?.code
  if (code === 'ENOSPC') return 'disk.full'
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'disk.permission'
  if (error instanceof Error && /HTTP 429/.test(error.message)) return 'network.rate'
  if (error instanceof Error && /HTTP 5\d\d/.test(error.message)) return 'network.server'
  if (error instanceof Error && /Processing failed/.test(error.message)) return 'processing.failed'
  if (error instanceof Error && /timeout|fetch failed|network/i.test(error.message)) return 'network.failed'
  return 'unknown'
}

const safeFilename = (name: string): string => {
  const cleaned = basename(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').slice(0, 170)
  return cleaned || `nib-${Date.now()}.bin`
}
const sourceName = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'link' }
}
const friendlyCobaltError = (code: string): string => {
  const key = code.replace(/^error\.api\./, '')
  if (key === 'service.unsupported' || key === 'link.invalid') return 'I can’t use this link yet. Check it and try again.'
  if (key === 'link.unsupported') return 'I know this site, but I couldn’t read that link. Try the direct post or video link.'
  if (key === 'service.audio_not_supported') return 'This site doesn’t offer audio-only saves here. Try Video.'
  if (key.includes('private') || key.includes('login') || key.includes('age')) return 'This media needs account access or has a viewing restriction. Check your session in Settings.'
  if (key.includes('region')) return 'This media is restricted in your region.'
  if (key.includes('rate') || key === 'rate_exceeded') return 'The site is slowing requests down. Please try again in a little while.'
  if (key.includes('unavailable') || key === 'fetch.empty') return 'I couldn’t find media at this link. It may have been removed or limited.'
  if (key.includes('paid') || key.includes('drm')) return 'This media is protected and cannot be saved.'
  if (key.includes('timed_out') || key.includes('fetch.fail') || key.includes('fetch.critical')) return 'The site didn’t respond properly. Please try again shortly.'
  return `I couldn’t finish this link (${code}). Please try again.`
}
const outputPath = (directory: string, filename: string): string => {
  const stem = parse(filename)
  let candidate = join(directory, filename)
  let number = 2
  while (existsSync(candidate)) candidate = join(directory, `${stem.name} (${number++})${stem.ext}`)
  return candidate
}

export class Downloads {
  private active = new Map<string, Control>()
  private pumping = false
  private processing = false
  constructor(private store: Store, private engine: CobaltEngine, private changed: (task: Task) => void, private ffmpeg: string, private structureChanged: () => void = () => {}) {}
  private save(task: Task): void { this.store.saveTask(task); this.changed(task) }
  submit(url: string, mode: MediaMode, pickerIndex?: number): string {
    const normalized = url.trim()
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Paste an HTTP or HTTPS link')
    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(), sourceUrl: normalized, title: sourceName(normalized), service: sourceName(normalized),
      mode, mediaType: mode, state: 'queued', bytesReceived: 0, bytesTotal: null, progress: null,
      stage: 'Waiting', error: null, outputPath: null, createdAt: now, updatedAt: now, completedAt: null,
      pickerIndex
    }
    this.save(task)
    this.pump()
    return task.id
  }
  select(id: string, indexes: number[]): void {
    const parent = this.store.getTask(id)
    if (!parent || parent.state !== 'choosing' || !parent.pickerItems) throw new Error('Selection is no longer available')
    const valid = [...new Set(indexes)].filter(index => Number.isInteger(index) && index >= 0 && index < parent.pickerItems!.length)
    if (!valid.length) throw new Error('Choose at least one item')
    this.store.deleteTask(id)
    for (const index of valid) this.submit(parent.sourceUrl, parent.mode, index)
    this.structureChanged()
  }
  action(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry'): void {
    const task = this.store.getTask(id)
    if (!task) throw new Error('Task was not found')
    const control = this.active.get(id)
    if (action === 'pause' && control && task.state === 'transferring') {
      control.paused = true; task.state = 'paused'; task.stage = 'Paused'; this.save(task)
    } else if (action === 'resume' && control && task.state === 'paused') {
      control.paused = false; control.wake?.(); task.state = 'transferring'; task.stage = 'Downloading'; this.save(task)
    } else if (action === 'cancel' && !['completed', 'canceled'].includes(task.state)) {
      control?.abort.abort(); control?.process?.kill(); if (control) { control.canceled = true; control.wake?.() }
      task.state = 'canceled'; task.stage = 'Canceled'; this.save(task)
    } else if (action === 'retry' && ['failed', 'canceled', 'paused'].includes(task.state) && !control) {
      task.state = 'queued'; task.error = null; task.errorCode = null; task.progress = null; task.bytesReceived = 0; task.bytesTotal = null; task.stage = 'Waiting'; this.save(task); this.pump()
    }
  }
  pump(): void {
    if (this.pumping) return
    this.pumping = true
    queueMicrotask(() => {
      this.pumping = false
      if (this.active.size >= 2) return
      for (const task of this.store.tasks().reverse()) {
        if (this.active.size >= 2) break
        if (task.state === 'queued' && !this.active.has(task.id)) {
          const control: Control = { abort: new AbortController(), paused: false, canceled: false }
          this.active.set(task.id, control)
          void this.run(task, control).finally(() => { this.active.delete(task.id); this.pump() })
        }
      }
    })
  }
  busy(): boolean { return this.active.size > 0 }
  private async run(task: Task, control: Control): Promise<void> {
    const tempFiles: string[] = []
    try {
      task.state = 'analyzing'; task.stage = 'Finding media'; this.save(task)
      const prefs = this.store.getPreferences()
      const response = await this.engine.request<CobaltResponse>({
        url: task.sourceUrl, downloadMode: task.mode === 'audio' ? 'audio' : 'auto',
        videoQuality: prefs.videoQuality, audioFormat: prefs.audioFormat,
        localProcessing: 'preferred'
      })
      if (control.canceled) return
      if (response.status === 'error') throw new DownloadError(response.error.code, friendlyCobaltError(response.error.code))
      if (response.status === 'picker' && task.pickerIndex === undefined) {
        task.state = 'choosing'; task.stage = 'Choose what to save'; task.pickerItems = response.picker; this.save(task); return
      }
      const directory = prefs.downloadDirectory
      mkdirSync(directory, { recursive: true })
      let finalName: string
      let urls: string[]
      let processType: string | null = null
      let audio: { copy: boolean; format: string; bitrate: string } | undefined
      if (response.status === 'picker') {
        const item = response.picker[task.pickerIndex!]
        if (!item) throw new Error('The selected item is no longer available')
        urls = [item.url]
        finalName = `nib-${task.id.slice(0, 8)}.${item.type === 'photo' ? 'jpg' : item.type === 'gif' ? 'gif' : 'mp4'}`
        task.mediaType = item.type === 'photo' ? 'image' : 'video'
      } else if (response.status === 'local-processing') {
        urls = response.tunnel
        finalName = response.output.filename
        processType = response.type
        audio = response.audio
      } else {
        urls = [response.url]
        finalName = response.filename || `nib-${task.id.slice(0, 8)}.${task.mode === 'audio' ? 'mp3' : 'mp4'}`
      }
      finalName = safeFilename(finalName)
      task.title = parse(finalName).name
      this.save(task)
      const incoming = join(directory, `.${task.id}.part${extname(finalName) || '.bin'}`)
      rmSync(incoming, { force: true })
      for (let index = 0; index < urls.length; index++) {
        const file = processType && processType !== 'proxy' ? `${incoming}.${index}` : incoming
        rmSync(file, { force: true })
        tempFiles.push(file)
        await this.transfer(task, control, urls[index], file)
        if (control.canceled) return
      }
      if (processType && processType !== 'proxy') {
        while (this.processing && !control.canceled) await new Promise(resolve => setTimeout(resolve, 200))
        if (control.canceled) return
        this.processing = true
        try {
          task.state = 'processing'; task.stage = 'Finishing your file'; task.progress = null; this.save(task)
          await this.process(task, control, tempFiles, incoming, processType, audio)
          tempFiles.push(incoming)
        } finally { this.processing = false }
      }
      if (control.canceled) return
      task.state = 'finalizing'; task.stage = 'Saving file'; task.progress = null; this.save(task)
      let destination = outputPath(directory, finalName)
      for (;;) {
        try { await copyFile(incoming, destination, constants.COPYFILE_EXCL); break }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          destination = outputPath(directory, finalName)
        }
      }
      if (control.canceled) { rmSync(destination, { force: true }); return }
      task.outputPath = destination; task.state = 'completed'; task.stage = 'Ready to open'
      task.completedAt = new Date().toISOString(); task.progress = 1
      task.bytesReceived = (await stat(destination)).size; task.bytesTotal = task.bytesReceived
      this.save(task)
    } catch (error) {
      if (!control.canceled) {
        task.state = 'failed'; task.error = error instanceof Error ? error.message : String(error)
        task.errorCode = errorCode(error)
        task.stage = 'Could not finish'; task.progress = null; this.save(task)
      }
    } finally {
      for (const file of tempFiles) rmSync(file, { force: true })
    }
  }
  private async transfer(task: Task, control: Control, url: string, file: string): Promise<void> {
    task.state = 'transferring'; task.stage = 'Downloading'; task.bytesReceived = 0; task.bytesTotal = null; task.progress = null; this.save(task)
    const response = await fetch(url, { signal: control.abort.signal, redirect: 'follow' })
    if (!response.ok || !response.body) throw new Error(`Download HTTP ${response.status}`)
    const exact = Number(response.headers.get('content-length'))
    task.bytesTotal = Number.isFinite(exact) && exact > 0 ? exact : null
    const stream = createWriteStream(file, { flags: 'wx' })
    let writeError: Error | null = null
    stream.on('error', error => { writeError = error })
    const reader = response.body.getReader()
    let lastUpdate = 0
    try {
      while (true) {
        if (control.paused) await new Promise<void>(resolve => { control.wake = resolve })
        if (control.canceled) throw new Error('Canceled')
        const { value, done } = await reader.read()
        if (writeError) throw writeError
        if (done) break
        await new Promise<void>((resolve, reject) => stream.write(value, error => error ? reject(error) : resolve()))
        task.bytesReceived += value.byteLength
        const now = Date.now()
        if (now - lastUpdate > 250) {
          task.progress = task.bytesTotal ? Math.min(task.bytesReceived / task.bytesTotal, 1) : null
          this.save(task); lastUpdate = now
        }
      }
      stream.end(); await once(stream, 'finish')
      if (task.bytesTotal && task.bytesReceived !== task.bytesTotal) throw new Error('Download was incomplete')
    } finally {
      reader.releaseLock()
      if (!stream.writableEnded) stream.destroy()
    }
  }
  private async process(task: Task, control: Control, inputs: string[], output: string, type: string, audio?: { copy: boolean; format: string; bitrate: string }): Promise<void> {
    const args = ['-y', ...inputs.flatMap(file => ['-i', file])]
    if (type === 'mute') args.push('-an', '-c:v', 'copy')
    else if (type === 'audio') args.push('-vn', ...(audio?.copy ? ['-c:a', 'copy'] : ['-b:a', `${audio?.bitrate || '128'}k`]))
    else if (type === 'gif') args.push('-vf', 'fps=12,scale=640:-1:flags=lanczos')
    else args.push('-c', 'copy')
    args.push(output)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.ffmpeg, args, { windowsHide: true })
      control.process = child
      let stderr = ''
      child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-1500) })
      child.once('error', reject)
      child.once('exit', code => { control.process = undefined; code === 0 ? resolve() : reject(new Error(`Processing failed: ${stderr}`)) })
    })
    task.stage = 'File complete'; this.save(task)
  }
}
