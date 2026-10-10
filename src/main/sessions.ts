import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { SessionService } from '../shared/types'

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
  clearRuntimeFile(): void { rmSync(this.cookiePath, { force: true }) }
}
