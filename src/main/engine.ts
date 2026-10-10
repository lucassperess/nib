import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { cp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, dirname, relative, isAbsolute, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Sessions } from './sessions'

const COBALT_REVISION = 'a636575b'

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
  get root(): string { return app.isPackaged ? join(this.runtimeDir, `cobalt-${COBALT_REVISION}-v3`) : join(app.getAppPath(), '.bundle', 'cobalt-api') }
  private async preparePackagedBundle(): Promise<void> {
    if (!app.isPackaged) return
    const source = join(process.resourcesPath, 'cobalt')
    const destination = this.root
    const ready = join(destination, '.nib-ready')
    if (existsSync(ready) && existsSync(join(destination, 'node_modules', 'dotenv', 'package.json'))) return
    const within = relative(this.runtimeDir, destination)
    if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error('Invalid local Cobalt destination')
    await rm(destination, { recursive: true, force: true })
    await cp(source, destination, { recursive: true, filter: async path => !(await lstat(path)).isSymbolicLink() })
    const links = JSON.parse(await readFile(join(source, 'nib-links.json'), 'utf8')) as { path: string; target: string }[]
    const rootPrefix = `node_modules${sep}`
    const poolPrefix = `node_modules${sep}.pnpm${sep}node_modules${sep}`
    const copyPackages = async (entries: { target: string; destination: string }[]) => {
      const queue = entries
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (queue.length) {
          const entry = queue.shift()!
          const path = join(destination, entry.destination)
          if (existsSync(path)) continue
          await mkdir(dirname(path), { recursive: true })
          await cp(join(source, entry.target), path, {
            recursive: true,
            filter: async file => !(await lstat(file)).isSymbolicLink()
          })
        }
      }))
    }
    const direct = links.filter(link => link.target && link.path.startsWith(rootPrefix) && !link.path.startsWith(`node_modules${sep}.pnpm${sep}`))
    const hoisted = links.filter(link => link.target && link.path.startsWith(poolPrefix))
    await copyPackages(direct.map(link => ({ target: link.target, destination: link.path })))
    await copyPackages(hoisted.map(link => ({ target: link.target, destination: join('node_modules', link.path.slice(poolPrefix.length)) })))
    const rootTargets = new Map(hoisted.map(link => [link.path.slice(poolPrefix.length), link.target]))
    for (const link of direct) rootTargets.set(link.path.slice(rootPrefix.length), link.target)
    const nestedCopies: { target: string; destination: string }[] = []
    const planDependencies = (packageTarget: string, packageDestination: string, visible: Map<string, string>): void => {
      const virtualBase = packageTarget.match(/^node_modules\\\.pnpm\\[^\\]+\\node_modules\\/)?.[0]
      if (!virtualBase) return
      for (const dependency of links) {
        if (!dependency.target || !dependency.path.startsWith(virtualBase)) continue
        const dependencyName = dependency.path.slice(virtualBase.length)
        if (visible.get(dependencyName) === dependency.target) continue
        const nestedDestination = join(packageDestination, 'node_modules', dependencyName)
        nestedCopies.push({ target: dependency.target, destination: nestedDestination })
        const nextVisible = new Map(visible)
        nextVisible.set(dependencyName, dependency.target)
        planDependencies(dependency.target, nestedDestination, nextVisible)
      }
    }
    for (const [name, packageTarget] of rootTargets) if (packageTarget) planDependencies(packageTarget, join('node_modules', name), rootTargets)
    for (const entry of nestedCopies) {
      const path = join(destination, entry.destination)
      await mkdir(dirname(path), { recursive: true })
      await cp(join(source, entry.target), path, { recursive: true, filter: async file => !(await lstat(file)).isSymbolicLink() })
    }
    await writeFile(ready, COBALT_REVISION)
  }
  async start(): Promise<void> {
    if (this.child) return
    await this.preparePackagedBundle()
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
