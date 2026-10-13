import type { SessionService } from '../shared/types'

export interface BrowserCookie {
  domain: string
  path: string
  name: string
  value: string
  secure: boolean
  httpOnly: boolean
  expirationDate?: number
}

const allowedDomains: Record<SessionService, string[]> = {
  youtube: ['youtube.com'],
  instagram: ['instagram.com'],
  twitter: ['x.com', 'twitter.com']
}

export function serializeBrowserCookies(service: SessionService, input: unknown): string {
  if (!(service in allowedDomains) || !Array.isArray(input) || !input.length || input.length > 300) throw new Error('No usable cookies for this site')
  const lines: string[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') throw new Error('Invalid browser cookie')
    const cookie = item as Partial<BrowserCookie>
    if (typeof cookie.domain !== 'string' || typeof cookie.path !== 'string' || typeof cookie.name !== 'string' || typeof cookie.value !== 'string' || typeof cookie.secure !== 'boolean' || typeof cookie.httpOnly !== 'boolean') throw new Error('Invalid browser cookie')
    if (!/^\.?[a-z0-9.-]+$/i.test(cookie.domain)) throw new Error('Invalid browser cookie')
    const host = cookie.domain.replace(/^\./, '').toLowerCase()
    if (!allowedDomains[service].some(domain => host === domain || host.endsWith(`.${domain}`))) throw new Error('Cookie does not belong to this site')
    if (!/^\/[\x20-\x7e]*$/.test(cookie.path) || /[\t\r\n]/.test(cookie.path) || !/^[^\s;=\x00-\x1f]{1,256}$/.test(cookie.name) || /[\x00-\x1f\x7f]/.test(cookie.value) || cookie.value.length > 8192) throw new Error('Invalid browser cookie')
    const expires = cookie.expirationDate === undefined ? 0 : Math.floor(cookie.expirationDate)
    if (!Number.isSafeInteger(expires) || expires < 0) throw new Error('Invalid browser cookie')
    const domain = cookie.domain.startsWith('.') ? `.${host}` : host
    const netscapeDomain = cookie.httpOnly ? `#HttpOnly_${domain}` : domain
    lines.push(`${netscapeDomain}\t${domain.startsWith('.') ? 'TRUE' : 'FALSE'}\t${cookie.path}\t${cookie.secure ? 'TRUE' : 'FALSE'}\t${expires}\t${cookie.name}\t${cookie.value}`)
  }
  const output = `# Netscape HTTP Cookie File\n${lines.join('\n')}\n`
  if (Buffer.byteLength(output) > 256_000) throw new Error('Too many cookies for this site')
  return output
}
