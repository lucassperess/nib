import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { SessionService } from '../shared/types'

const PORT = 43837
const MAX_BODY = 256_000
const TTL_MS = 5 * 60_000
const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/
const services: SessionService[] = ['youtube', 'instagram', 'twitter']

export class SessionPairing {
  private server: Server | null = null
  private code = ''
  private service: SessionService | null = null
  private expiresAt = 0
  private failures = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private importCookies: (service: SessionService, cookies: unknown) => void, private port = PORT) {}

  async begin(service: SessionService): Promise<{ code: string; expiresAt: number; port: number }> {
    if (!services.includes(service)) throw new Error('Unknown service')
    this.code = randomBytes(6).toString('hex').toUpperCase()
    this.service = service
    this.expiresAt = Date.now() + TTL_MS
    this.failures = 0
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.stop(), TTL_MS)
    if (this.server) {
      const address = this.server.address()
      return { code: this.code, expiresAt: this.expiresAt, port: typeof address === 'object' && address ? address.port : this.port }
    }
    const server = createServer((request, response) => {
      const origin = request.headers.origin || ''
      const reply = (status: number, message: string): void => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ ok: status === 200, message }))
      }
      if (!extensionOrigin.test(origin)) { reply(403, 'Browser extension required'); return }
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '120' })
        response.end()
        return
      }
      if (request.method !== 'POST' || request.url !== '/session' || !request.headers['content-type']?.startsWith('application/json')) { reply(404, 'Unknown request'); return }
      if (this.failures >= 5 || Date.now() > this.expiresAt || !this.service) { reply(429, 'Start a new connection in Nib'); return }
      const chunks: Buffer[] = []
      let size = 0
      request.on('data', chunk => {
        size += chunk.length
        if (size > MAX_BODY) request.destroy()
        else chunks.push(chunk)
      })
      request.on('end', () => {
        if (size > MAX_BODY) return
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { code?: unknown; service?: unknown; cookies?: unknown }
          const received = typeof payload.code === 'string' ? Buffer.from(payload.code.toUpperCase()) : Buffer.alloc(0)
          const expected = Buffer.from(this.code)
          if (received.length !== expected.length || !timingSafeEqual(received, expected) || payload.service !== this.service) {
            this.failures++
            reply(403, 'Code or site does not match')
            return
          }
          const service = this.service
          if (!service) throw new Error('Connection expired')
          this.importCookies(service, payload.cookies)
          reply(200, 'Session imported into Nib')
          this.stop()
        } catch {
          reply(400, 'Could not import this session')
        }
      })
    })
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(this.port, '127.0.0.1', () => { server.off('error', reject); resolve() })
      })
      this.server = server
      const address = server.address()
      return { code: this.code, expiresAt: this.expiresAt, port: typeof address === 'object' && address ? address.port : this.port }
    } catch {
      server.close()
      this.stop()
      throw new Error('Nib could not open its local browser connection')
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.server?.close()
    this.server = null
    this.code = ''
    this.service = null
    this.expiresAt = 0
  }
}
