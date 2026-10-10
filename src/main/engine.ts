import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Sessions } from './sessions'

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => address && typeof address !== 'string' ? resolve(address.port) : reject(new Error('No port')))
    })
  })
}

export class CobaltEngine {
  private child: ChildProcess | null = null
  private key = ''
  private url = ''
  private keyFile: string
  private stderr = ''
  private spawnError: Error | null = null
  constructor(private sessions: Sessions, private runtimeDir: string) {
    mkdirSync(runtimeDir, { recursive: true })
    this.keyFile = join(runtimeDir, 'key.runtime.json')
    rmSync(this.keyFile, { force: true })
  }
  get baseUrl(): string { if (!this.url) throw new Error('Cobalt is not running'); return this.url }
  get root(): string { return app.isPackaged ? join(process.resourcesPath, 'cobalt') : join(app.getAppPath(), '.bundle', 'cobalt-api') }
  async start(): Promise<void> {
    if (this.child) return
    const port = await freePort()
    this.url = `http://127.0.0.1:${port}/`
    this.key = randomUUID()
    writeFileSync(this.keyFile, JSON.stringify({ [this.key]: { name: 'Nib local client', limit: 'unlimited', ips: ['127.0.0.1'] } }), { mode: 0o600 })
    this.sessions.materialize()
    const cobaltRoot = this.root
    const node = app.isPackaged ? join(process.resourcesPath, 'node.exe') : 'node'
    const entry = join(cobaltRoot, 'src', 'cobalt.js')
    this.stderr = ''
    this.spawnError = null
    this.child = spawn(node, [entry], {
      cwd: cobaltRoot,
      windowsHide: true,
      env: {
        ...process.env,
        API_URL: this.url,
        API_PORT: String(port),
        API_LISTEN_ADDRESS: '127.0.0.1',
        API_KEY_URL: `file:///${this.keyFile.replaceAll('\\', '/')}`,
        API_AUTH_REQUIRED: '1',
        COOKIE_PATH: this.sessions.cookiePath,
        CORS_WILDCARD: '0',
        FORCE_LOCAL_PROCESSING: 'never'
      }
    })
    this.child.stderr?.on('data', chunk => { this.stderr = (this.stderr + String(chunk)).slice(-2000) })
    this.child.stdout?.on('data', chunk => { this.stderr = (this.stderr + String(chunk)).slice(-2000) })
    this.child.once('error', error => { this.spawnError = error })
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (this.spawnError) throw this.spawnError
      if (this.child.exitCode !== null) throw new Error(`Cobalt exited: ${this.stderr}`)
      try {
        const response = await fetch(this.url, { signal: AbortSignal.timeout(1000) })
        if (response.ok) return
      } catch { /* wait for child startup */ }
      await new Promise(resolve => setTimeout(resolve, 350))
    }
    this.stop()
    throw new Error(`Cobalt did not start: ${this.stderr}`)
  }
  async request<T>(body: unknown): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Api-Key ${this.key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`Cobalt HTTP ${response.status}`)
    return await response.json() as T
  }
  async restart(): Promise<void> { this.stop(); await this.start() }
  stop(): void {
    this.child?.kill()
    this.child = null
    this.url = ''
    this.key = ''
    rmSync(this.keyFile, { force: true })
    this.sessions.clearRuntimeFile()
  }
}
