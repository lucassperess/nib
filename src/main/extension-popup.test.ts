import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(resolve('extension/popup.js'), 'utf8')

async function popup(url: string, options: { language?: string; permitted?: boolean } = {}) {
  const handlers = new Map<string, () => Promise<void> | void>()
  const elements = new Map<string, {
    textContent: string; value: string; disabled: boolean; options: { textContent: string }[];
    setAttribute: (name: string, value: string) => void;
    addEventListener: (event: string, handler: () => Promise<void> | void) => void
  }>()
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', value: '', disabled: false, options: [{ textContent: '' }],
      setAttribute: () => {}, addEventListener: (event, handler) => { handlers.set(`${id}:${event}`, handler) }
    })
    return elements.get(id)!
  }
  const storage = { language: options.language }
  const get = vi.fn(async () => ({ language: storage.language ?? 'pt-BR' }))
  const set = vi.fn(async (value: { language: string }) => { storage.language = value.language })
  const query = vi.fn(async () => [{ url }])
  const request = vi.fn(async () => options.permitted !== false)
  const getAll = vi.fn(async (query: { domain: string }) => [{ domain: `.${query.domain}`, path: '/', name: 'SID', value: 'synthetic', secure: true, httpOnly: true }])
  const fetch = vi.fn(async (_url: string, _options: { body: string }) => ({ ok: true }))
  const document = { documentElement: { lang: '' }, getElementById: element }
  runInNewContext(source, { URL, document, chrome: { storage: { local: { get, set } }, tabs: { query }, permissions: { request }, cookies: { getAll } }, fetch })
  await new Promise(resolve => setImmediate(resolve))
  return { element, storage, get, set, query, request, getAll, fetch, document,
    click: async (id: string) => { await handlers.get(`${id}:click`)?.() },
    change: async (id: string) => { await handlers.get(`${id}:change`)?.() }
  }
}

describe('extension popup', () => {
  it.each([
    ['https://x.com/home', 'twitter'],
    ['https://mobile.twitter.com/user/status/123', 'twitter'],
    ['https://www.instagram.com/reel/ABC/', 'instagram'],
    ['https://www.youtube.com/watch?v=ABC', 'youtube']
  ])('selects the service for %s when opened', async (url, service) => {
    const app = await popup(url)
    expect(app.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
    expect(app.element('service').value).toBe(service)
    expect(app.getAll).not.toHaveBeenCalled()
  })

  it.each(['chrome://extensions/', 'https://x.com.evil.example/post', 'https://example.com/'])('requires a manual choice for unsupported tab %s', async url => {
    const app = await popup(url)
    expect(app.element('service').value).toBe('')
    app.element('code').value = 'ABC123'
    await app.click('send')
    expect(app.request).not.toHaveBeenCalled()
    expect(app.fetch).not.toHaveBeenCalled()
  })

  it('sends cookies for the detected X site only after permission and a click', async () => {
    const app = await popup('https://x.com/home')
    expect(app.getAll).not.toHaveBeenCalled()
    app.element('code').value = 'abc123'
    await app.click('send')
    expect(app.request).toHaveBeenCalledWith({ origins: expect.arrayContaining(['https://x.com/*', 'https://twitter.com/*']) })
    expect(app.getAll).toHaveBeenCalledWith({ domain: 'x.com' })
    expect(app.getAll).toHaveBeenCalledWith({ domain: 'twitter.com' })
    const body = JSON.parse(app.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ service: 'twitter', code: 'ABC123' })
    expect(body.cookies).toHaveLength(2)
    expect(app.element('code').value).toBe('')
  })

  it('lets the user override the detected site', async () => {
    const app = await popup('https://x.com/home')
    app.element('service').value = 'instagram'
    await app.change('service')
    app.element('code').value = 'ABC123'
    await app.click('send')
    expect(app.getAll).toHaveBeenCalledWith({ domain: 'instagram.com' })
    expect(app.getAll).not.toHaveBeenCalledWith({ domain: 'x.com' })
  })

  it('defaults to Portuguese, switches to English, and remembers only the language', async () => {
    const app = await popup('https://x.com/home')
    expect(app.document.documentElement.lang).toBe('pt-BR')
    expect(app.element('send').textContent).toBe('Enviar sessão ao Nib')
    await app.click('language')
    expect(app.document.documentElement.lang).toBe('en')
    expect(app.element('send').textContent).toBe('Send session to Nib')
    expect(app.set).toHaveBeenCalledWith({ language: 'en' })
    expect(app.storage).toEqual({ language: 'en' })
    const reopened = await popup('https://x.com/home', { language: 'en' })
    expect(reopened.element('send').textContent).toBe('Send session to Nib')
  })

  it('does not read or send cookies when the site permission is denied', async () => {
    const app = await popup('https://www.youtube.com/watch?v=1', { permitted: false })
    app.element('code').value = 'ABC123'
    await app.click('send')
    expect(app.getAll).not.toHaveBeenCalled()
    expect(app.fetch).not.toHaveBeenCalled()
  })
})
