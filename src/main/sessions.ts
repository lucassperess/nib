import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { SessionService } from '../shared/types'
import { serializeBrowserCookies } from './browser-cookies'

type Vault = Partial<Record<SessionService, string>>
const SERVICES: SessionService[] = ['instagram', 'youtube', 'twitter']

export class Sessions {
  private vaultPath: string
  readonly cookiePath: string
  constructor(private directory: string) {
    mkdirSync(directory, { recursive: true })
    this.vaultPath = join(directory, 'sessions.enc.json')
    this.cookiePath = join(directory, 'cookies.runtime.json')
    this.clearRuntimeFile()
  }
  private readVault(): Vault {
    if (!existsSync(this.vaultPath)) return {}
    return JSON.parse(readFileSync(this.vaultPath, 'utf8')) as Vault
  }
  status(): Record<SessionService, boolean> {
    const vault = this.readVault()
    return { instagram: !!vault.instagram, youtube: !!vault.youtube, twitter: !!vault.twitter }
  }
  import(service: SessionService, cookie: string): void {
    if (!SERVICES.includes(service)) throw new Error('Unknown service')
    const trimmed = cookie.trim()
    if (!trimmed || trimmed.length > 16_384 || !trimmed.includes('=')) throw new Error('Enter a valid cookie string')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential protection is unavailable')
    const vault = this.readVault()
    vault[service] = safeStorage.encryptString(trimmed).toString('base64')
    writeFileSync(this.vaultPath, JSON.stringify(vault), { mode: 0o600 })
  }
  importBrowser(service: SessionService, cookies: unknown): void {
    if (!SERVICES.includes(service)) throw new Error('Unknown service')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential protection is unavailable')
    const serialized = serializeBrowserCookies(service, cookies)
    const vault = this.readVault()
    vault[service] = safeStorage.encryptString(serialized).toString('base64')
    writeFileSync(this.vaultPath, JSON.stringify(vault), { mode: 0o600 })
  }
  clear(service: SessionService): void {
    const vault = this.readVault()
    delete vault[service]
    writeFileSync(this.vaultPath, JSON.stringify(vault), { mode: 0o600 })
  }
  materialize(): void {
    const vault = this.readVault()
    const cookies: Record<string, string[]> = {}
    for (const service of SERVICES) {
      if (vault[service]) cookies[service] = [safeStorage.decryptString(Buffer.from(vault[service], 'base64'))]
    }
    writeFileSync(this.cookiePath, JSON.stringify(cookies), { mode: 0o600 })
  }
  materializeFor(url: string, file: string): string | null {
    const host = new URL(url).hostname.toLowerCase()
    const service: SessionService | null = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host) ? 'youtube'
      : /(^|\.)instagram\.com$/.test(host) ? 'instagram'
      : /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(host) ? 'twitter' : null
    rmSync(file, { force: true })
    if (!service) return null
    const encrypted = this.readVault()[service]
    if (!encrypted) return null
    const domain = service === 'youtube' ? '.youtube.com' : service === 'instagram' ? '.instagram.com' : '.x.com'
    const raw = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    if (raw.startsWith('# Netscape HTTP Cookie File\n')) {
      writeFileSync(file, raw, { mode: 0o600 })
      return file
    }
    const lines = raw.split(';').map(part => part.trim()).filter(Boolean).flatMap(part => {
      const index = part.indexOf('=')
      if (index <= 0) return []
      const name = part.slice(0, index).trim(), value = part.slice(index + 1).trim()
      if (/^(path|domain|expires|max-age|samesite|secure|httponly)$/i.test(name) || /[\r\n\t]/.test(part)) return []
      return [`${domain}\tTRUE\t/\tTRUE\t0\t${name}\t${value}`]
    })
    if (!lines.length) return null
    writeFileSync(file, `# Netscape HTTP Cookie File\n${lines.join('\n')}\n`, { mode: 0o600 })
    return file
  }
  clearRuntimeFile(): void { rmSync(this.cookiePath, { force: true }) }
}
