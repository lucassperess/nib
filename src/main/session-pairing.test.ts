import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionPairing } from './session-pairing'

const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const cookies = [{ domain: '.youtube.com', path: '/', name: 'SID', value: 'secret', secure: true, httpOnly: true }]
let pairing: SessionPairing | null = null
afterEach(() => { pairing?.stop(); pairing = null })

describe('browser pairing', () => {
  it('accepts one matching session and rejects a wrong code', async () => {
    const imported = vi.fn()
    pairing = new SessionPairing(imported, 0)
    const { code, port } = await pairing.begin('youtube')
    const send = (value: string) => fetch(`http://127.0.0.1:${port}/session`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'youtube', code: value, cookies })
    })
    expect((await send('WRONG')).status).toBe(403)
    expect(imported).not.toHaveBeenCalled()
    expect((await send(code)).status).toBe(200)
    expect(imported).toHaveBeenCalledOnce()
    expect(imported).toHaveBeenCalledWith('youtube', cookies)
  })

  it('rejects requests from a web page even with the right code', async () => {
    const imported = vi.fn()
    pairing = new SessionPairing(imported, 0)
    const { code, port } = await pairing.begin('youtube')
    const response = await fetch(`http://127.0.0.1:${port}/session`, {
      method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'youtube', code, cookies })
    })
    expect(response.status).toBe(403)
    expect(imported).not.toHaveBeenCalled()
  })
})
