import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { constants, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, parse, relative, resolve } from 'node:path'
import type { MediaMode, PickerItem, Preferences, Task } from '../shared/types'
import { Store } from './store'
import { MediaEngine } from './engine'
import { Sessions } from './sessions'

type Control = { process?: ChildProcess; paused: boolean; canceled: boolean }
type MediaInfo = { title?: string; ext?: string; entries?: Array<{ title?: string; url?: string; thumbnail?: string; ext?: string }> }
class DownloadError extends Error { constructor(readonly code: string, message: string) { super(message) } }

const safeFilename = (name: string): string => basename(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').slice(0, 170) || `nib-${Date.now()}.bin`
const safeDetail = (message: string): string => message.replace(/https?:\/\/\S+/g, '[link]').replace(/[A-Za-z]:\\[^\r\n]+/g, '[local file]').slice(0, 300)
const sourceName = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'link' } }
const classifyError = (message: string): string => {
  if (/unsupported url|no suitable extractor/i.test(message)) return 'media.unsupported'
  if (/private|sign in|login|cookies|age.restricted/i.test(message)) return 'media.session'
  if (/not available|unavailable|removed|does not exist/i.test(message)) return 'media.unavailable'
  if (/429|too many requests|rate.limit/i.test(message)) return 'network.rate'
  if (/403|timed out|network|unable to download|connection|http error/i.test(message)) return 'network.failed'
  return 'media.failed'
}
const outputPath = (directory: string, filename: string): string => {
  const stem = parse(filename)
  let candidate = join(directory, filename)
  let number = 2
  while (existsSync(candidate)) candidate = join(directory, `${stem.name} (${number++})${stem.ext}`)
  return candidate
}
function tempDirectory(directory: string, id: string): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid task ID')
  const target = resolve(directory, `.nib-${id}`)
  const within = relative(resolve(directory), target)
  if (within !== `.nib-${id}` || within.startsWith('..') || isAbsolute(within)) throw new Error('Invalid temporary directory')
  return target
}
function runInfo(engine: MediaEngine, url: string, cookies?: string): Promise<MediaInfo> {
  return new Promise((resolveInfo, reject) => {
    const host = sourceName(url)
    const args = [...engine.commonArgs(), '--dump-single-json', '--flat-playlist', '--skip-download', '--playlist-end', '50']
    if (host === 'youtube.com' || host === 'youtu.be') args.push('--no-playlist')
    if (cookies) args.push('--cookies', cookies)
    args.push('--', url)
    const child = spawn(engine.binary, args, { windowsHide: true })
    let stdout = '', stderr = ''
    const timer = setTimeout(() => child.kill(), 45_000)
    child.stdout?.on('data', chunk => { stdout += String(chunk); if (stdout.length > 8_000_000) child.kill() })
    child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-2500) })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', code => {
      clearTimeout(timer)
      if (code !== 0) { reject(new DownloadError(classifyError(stderr), safeDetail(stderr.split(/\r?\n/).filter(Boolean).at(-1) || 'Could not read this link'))); return }
      try { resolveInfo(JSON.parse(stdout) as MediaInfo) }
      catch { reject(new DownloadError('media.failed', 'The site returned invalid media information')) }
    })
  })
}

export class Downloads {
  private active = new Map<string, Control>()
  private pumping = false
  constructor(private store: Store, private engine: MediaEngine, private sessions: Sessions, private changed: (task: Task) => void, private structureChanged: () => void = () => {}) {}
  private save(task: Task): void { this.store.saveTask(task); this.changed(task) }

  submit(url: string, mode: MediaMode, pickerIndex?: number): string {
    const normalized = url.trim()
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Paste an HTTP or HTTPS link')
    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(), sourceUrl: normalized, title: sourceName(normalized), service: sourceName(normalized),
      mode, mediaType: mode, state: 'queued', bytesReceived: 0, bytesTotal: null, progress: null,
      stage: 'Waiting', error: null, outputPath: null, createdAt: now, updatedAt: now, completedAt: null, pickerIndex
    }
    this.save(task); this.pump(); return task.id
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

  action(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry' | 'remove'): void {
    const task = this.store.getTask(id)
    if (!task) throw new Error('Task was not found')
    const control = this.active.get(id)
    if (action === 'remove') {
      if (!['failed', 'canceled'].includes(task.state)) throw new Error('Only failed or canceled tasks can be removed')
      this.store.deleteTask(id); this.structureChanged(); return
    }
    if (action === 'pause' && control && task.state === 'transferring') {
      control.paused = true; control.process?.kill(); task.state = 'paused'; task.stage = 'Paused'; this.save(task)
    } else if (action === 'resume' && task.state === 'paused') {
      task.state = 'queued'; task.stage = 'Waiting'; this.save(task); this.pump()
    } else if (action === 'cancel' && !['completed', 'canceled'].includes(task.state)) {
      if (control) { control.canceled = true; control.process?.kill() }
      task.state = 'canceled'; task.stage = 'Canceled'; this.save(task)
    } else if (action === 'retry' && ['failed', 'canceled'].includes(task.state) && !control) {
      task.state = 'queued'; task.error = null; task.errorCode = null; task.progress = null
      task.bytesReceived = 0; task.bytesTotal = null; task.stage = 'Waiting'; this.save(task); this.pump()
    }
  }

  pump(): void {
    if (this.pumping) return
    this.pumping = true
    queueMicrotask(() => {
      this.pumping = false
      for (const task of this.store.tasks().reverse()) {
        if (this.active.size >= 2) break
        if (task.state !== 'queued' || this.active.has(task.id)) continue
        const control: Control = { paused: false, canceled: false }
        this.active.set(task.id, control)
        void this.run(task, control).finally(() => { this.active.delete(task.id); this.pump() })
      }
    })
  }
  busy(): boolean { return this.active.size > 0 }

  private async run(task: Task, control: Control): Promise<void> {
    const prefs = this.store.getPreferences()
    const directory = prefs.downloadDirectory
    const temp = tempDirectory(directory, task.id)
    let keepTemp = false
    try {
      await mkdir(temp, { recursive: true })
      const cookies = this.sessions.materializeFor(task.sourceUrl, join(temp, 'cookies.txt'))
      task.state = 'analyzing'; task.stage = 'Finding media'; this.save(task)
      const info = await runInfo(this.engine, task.sourceUrl, cookies || undefined)
      if (control.canceled || control.paused) return
      if (info.entries && info.entries.length > 1 && task.pickerIndex === undefined) {
        task.pickerItems = info.entries.map((entry): PickerItem => ({
          type: /jpe?g|png|webp/i.test(entry.ext || '') ? 'photo' : 'video',
          url: entry.url || task.sourceUrl, thumb: entry.thumbnail
        }))
        task.state = 'choosing'; task.stage = 'Choose what to save'; this.save(task); return
      }
      task.title = safeFilename(info.entries?.[task.pickerIndex ?? -1]?.title || info.title || task.title)
      this.save(task)
      const args = [...this.engine.commonArgs(), '--newline', '--progress', '--progress-template', 'download:NIB_PROGRESS:%(progress.downloaded_bytes)s:%(progress.total_bytes)s',
        '--continue', '--retries', '3', '--fragment-retries', '3', '--concurrent-fragments', '4', '--no-mtime',
        '--paths', temp, '-o', `${task.id}.%(ext)s`]
      if (sourceName(task.sourceUrl) === 'youtube.com' || sourceName(task.sourceUrl) === 'youtu.be') args.push('--no-playlist')
      if (cookies) args.push('--cookies', cookies)
      if (task.pickerIndex !== undefined) args.push('--playlist-items', String(task.pickerIndex + 1))
      if (task.mode === 'audio') {
        args.push('-f', 'ba/b', '-x', '--audio-format', prefs.audioFormat)
      } else {
        args.push('-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b', '--merge-output-format', 'mp4')
        if (prefs.videoQuality !== 'max') args.push('-S', `res:${prefs.videoQuality}`)
      }
      args.push('--', task.sourceUrl)
      task.state = 'transferring'; task.stage = 'Downloading'; task.progress = null; this.save(task)
      await this.downloadProcess(task, control, args)
      if (control.paused) { keepTemp = true; return }
      if (control.canceled) return
      const files = readdirSync(temp).filter(name => name.startsWith(task.id + '.') && !/\.part$|\.ytdl$/.test(name))
      if (files.length !== 1) throw new DownloadError('media.failed', 'The download did not produce one complete file')
      const incoming = join(temp, files[0])
      if ((await stat(incoming)).size === 0) throw new DownloadError('media.empty', 'The source returned an empty media file')
      const finalName = safeFilename(`${task.title}${extname(files[0])}`)
      task.state = 'finalizing'; task.stage = 'Saving file'; task.progress = null; this.save(task)
      let destination = outputPath(directory, finalName)
      for (;;) {
        try { await copyFile(incoming, destination, constants.COPYFILE_EXCL); break }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          destination = outputPath(directory, finalName)
        }
      }
      if (control.canceled) { await rm(destination, { force: true }); return }
      task.outputPath = destination; task.state = 'completed'; task.stage = 'Ready to open'
      task.completedAt = new Date().toISOString(); task.progress = 1
      task.bytesReceived = (await stat(destination)).size; task.bytesTotal = task.bytesReceived
      this.save(task)
    } catch (error) {
      if (control.paused) { keepTemp = true; return }
      if (!control.canceled) {
        task.state = 'failed'
        task.errorCode = error instanceof DownloadError ? error.code : (error as NodeJS.ErrnoException)?.code === 'ENOSPC' ? 'disk.full' : 'media.failed'
        task.error = error instanceof Error ? error.message : String(error)
        task.stage = 'Could not finish'; task.progress = null; this.save(task)
      }
    } finally {
      if (!keepTemp) await rm(temp, { recursive: true, force: true })
    }
  }

  private downloadProcess(task: Task, control: Control, args: string[]): Promise<void> {
    return new Promise((resolveTask, reject) => {
      const child = spawn(this.engine.binary, args, { windowsHide: true })
      control.process = child
      let stderr = '', lineBuffer = '', lastUpdate = 0
      const consume = (line: string) => {
        const progress = line.match(/NIB_PROGRESS:(\d+):(?:(\d+)|NA)/)
        if (progress) {
          const received = Number(progress[1]), total = Number(progress[2])
          task.bytesReceived = received
          task.bytesTotal = Number.isFinite(total) && total > 0 ? total : null
          task.progress = task.bytesTotal ? Math.min(received / task.bytesTotal, 1) : null
          if (Date.now() - lastUpdate > 250) { this.save(task); lastUpdate = Date.now() }
        } else if (/^\[(Merger|ExtractAudio|VideoRemuxer|Fixup)/.test(line) && task.state !== 'processing') {
          task.state = 'processing'; task.stage = 'Finishing your file'; task.progress = null; this.save(task)
        }
      }
      child.stdout?.on('data', chunk => {
        lineBuffer += String(chunk)
        const lines = lineBuffer.split(/\r?\n/)
        lineBuffer = lines.pop() || ''
        for (const line of lines) consume(line)
      })
      child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-3000) })
      child.once('error', reject)
      child.once('close', code => {
        control.process = undefined
        if (control.paused || control.canceled) { resolveTask(); return }
        if (code === 0) { resolveTask(); return }
        const last = stderr.split(/\r?\n/).filter(Boolean).at(-1) || 'Could not download this media'
        reject(new DownloadError(classifyError(stderr), safeDetail(last)))
      })
    })
  }
}
