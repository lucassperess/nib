import { describe, expect, it } from 'vitest'
import { serializeBrowserCookies } from './browser-cookies'

describe('browser cookie import', () => {
  it('preserves cookie scope and HttpOnly in Netscape format', () => {
    const output = serializeBrowserCookies('youtube', [{ domain: '.youtube.com', path: '/watch', name: 'SID', value: 'abc', secure: true, httpOnly: true, expirationDate: 2_000_000_000 }])
    expect(output).toContain('#HttpOnly_.youtube.com\tTRUE\t/watch\tTRUE\t2000000000\tSID\tabc')
  })

  it('rejects cookies outside the chosen service and control characters', () => {
    const valid = { domain: '.youtube.com', path: '/', name: 'SID', value: 'abc', secure: true, httpOnly: true }
    expect(() => serializeBrowserCookies('youtube', [{ ...valid, domain: '.example.com' }])).toThrow()
    expect(() => serializeBrowserCookies('youtube', [{ ...valid, domain: 'evil\n.youtube.com' }])).toThrow()
    expect(() => serializeBrowserCookies('youtube', [{ ...valid, value: 'abc\nmalicious' }])).toThrow()
  })
})
