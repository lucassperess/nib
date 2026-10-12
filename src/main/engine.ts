import { app } from 'electron'
import { spawn } from 'node:child_process'
import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function capture(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true })
    let output = ''
    child.stdout?.on('data', chunk => { output = (output + String(chunk)).slice(-4000) })
    child.stderr?.on('data', chunk => { output = (output + String(chunk)).slice(-4000) })
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`Download engine exited ${code}: ${output.slice(-400)}`)))
  })
}

export class MediaEngine {
  readonly binary: string
  readonly ffmpeg: string
  readonly node: string
  version = ''

  constructor(private runtimeDir: string) {
    this.binary = join(runtimeDir, 'tools', 'yt-dlp.exe')
    const resources = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), '.runtime')
    this.ffmpeg = join(resources, 'ffmpeg.exe')
    this.node = join(resources, 'node.exe')
  }

  async start(): Promise<void> {
    const resources = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), '.runtime')
    const bundled = join(resources, 'yt-dlp.exe')
    if (!existsSync(bundled) || !existsSync(this.ffmpeg) || !existsSync(this.node)) throw new Error('A download tool is missing from this installation')
    await mkdir(join(this.runtimeDir, 'tools'), { recursive: true })
    const bundledVersion = await capture(bundled, ['--version'])
    const currentVersion = existsSync(this.binary) ? await capture(this.binary, ['--version']).catch(() => '') : ''
    if (!currentVersion || currentVersion < bundledVersion) await copyFile(bundled, this.binary)
    this.version = await capture(this.binary, ['--version'])
  }

  async restart(): Promise<void> { await this.start() }

  async update(): Promise<string> {
    await capture(this.binary, ['--no-config', '--update-to', 'nightly'])
    this.version = await capture(this.binary, ['--version'])
    return this.version
  }

  commonArgs(): string[] {
    return ['--no-config', '--no-update', '--no-playlist', '--no-color', '--js-runtimes', `node:${this.node}`, '--ffmpeg-location', this.ffmpeg]
  }

  stop(): void { /* each download has its own child process */ }
}
