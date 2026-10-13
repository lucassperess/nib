import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(resolve('extension/popup.js'), 'utf8')

function popup(permitted: boolean) {
  const elements = new Map<string, { textContent: string; value: string; disabled: boolean; addEventListener: (event: string, handler: () => Promise<void>) => void }>()
  let click: () => Promise<void> = async () => {}
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', value: '', disabled: false, addEventListener: (_event, handler) => { click = handler } })
    return elements.get(id)!
  }
  const request = vi.fn(async () => permitted)
  const getAll = vi.fn(async (_query: { domain: string }) => [{ domain: '.youtube.com', path: '/', name: 'SID', value: 'synthetic', secure: true, httpOnly: true }])
  const fetch = vi.fn(async (_url: string, _options: { body: string }) => ({ ok: true }))
  runInNewContext(source, { navigator: { language: 'pt-BR' }, document: { getElementById: element }, chrome: { permissions: { request }, cookies: { getAll } }, fetch })
  element('service').value = 'youtube'
  element('code').value = 'ABC123'
  return { click: () => click(), request, getAll, fetch, element }
}

describe('extension popup', () => {
  it('asks for the selected site before collecting and sending cookies', async () => {
    const app = popup(true)
    await app.click()
    expect(app.request).toHaveBeenCalledOnce()
    expect(app.getAll).toHaveBeenCalledWith({ domain: 'youtube.com' })
    const body = JSON.parse(app.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ service: 'youtube', code: 'ABC123', cookies: [{ value: 'synthetic' }] })
    expect(app.element('code').value).toBe('')
  })

  it('does not collect cookies when site permission is denied', async () => {
    const app = popup(false)
    await app.click()
    expect(app.getAll).not.toHaveBeenCalled()
    expect(app.fetch).not.toHaveBeenCalled()
  })
})
