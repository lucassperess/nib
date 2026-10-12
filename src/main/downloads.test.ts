import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, isAbsolute } from 'node:path'
import { Downloads } from './downloads'
import type { Task, Preferences } from '../shared/types'
import type { Store } from './store'
import type { CobaltEngine } from './engine'

let folder: string
beforeEach(() => { folder = mkdtempSync(join(tmpdir(), 'nib-picker-test-')) })
afterEach(() => {
  vi.unstubAllGlobals()
  const within = relative(resolve(tmpdir()), resolve(folder))
  if (within.startsWith('..') || isAbsolute(within) || !within.startsWith('nib-picker-test-')) throw new Error('Unsafe test cleanup')
  rmSync(folder, { recursive: true, force: true })
})

function testStore(records: Map<string, Task>): Store {
  return {
    saveTask(task: Task) { records.set(task.id, structuredClone(task)) },
    getTask(id: string) { return records.get(id) },
    tasks() { return [...records.values()] },
    getPreferences() { return { downloadDirectory: folder, videoQuality: 'max', audioFormat: 'best', reducedMotion: false, locale: 'system', tutorialSeenVersion: 0 } }
  } as Store
}

it('marks a failed transfer as a retryable network error', async () => {
  const records = new Map<string, Task>()
  const engine = { request: async () => ({ status: 'redirect', url: 'https://example.com/media', filename: 'clip.mp4' }) } as unknown as CobaltEngine
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }))
  const downloads = new Downloads(testStore(records), engine, () => {}, 'ffmpeg')
  const id = downloads.submit('https://example.com/post', 'video')
  await waitFor(() => records.get(id)?.state === 'failed')
  expect(records.get(id)?.errorCode).toBe('network.server')
  downloads.action(id, 'retry')
  await waitFor(() => records.get(id)?.state === 'failed')
  expect(records.get(id)?.errorCode).toBe('network.server')
})

it('reports an empty Cobalt tunnel before sending it to FFmpeg', async () => {
  const records = new Map<string, Task>()
  const engine = { request: async () => ({
    status: 'local-processing', type: 'merge', tunnel: ['https://example.com/empty'],
    output: { filename: 'clip.mp4', type: 'video/mp4' }
  }) } as unknown as CobaltEngine
  vi.stubGlobal('fetch', async () => new Response(new Uint8Array(), { status: 200, headers: { 'content-length': '0' } }))
  const downloads = new Downloads(testStore(records), engine, () => {}, 'missing-ffmpeg')
  const id = downloads.submit('https://example.com/post', 'video')
  await waitFor(() => records.get(id)?.state === 'failed')
  expect(records.get(id)?.errorCode).toBe('media.empty')
  expect(records.get(id)?.error).toBe('The source returned an empty media file')
  expect(readdirSync(folder)).toEqual([])
})

it('pauses and resumes a transfer without losing received bytes', async () => {
  const records = new Map<string, Task>()
  let releaseSecond!: () => void
  const second = new Promise<void>(resolve => { releaseSecond = resolve })
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])) },
    async pull(controller) { await second; controller.enqueue(new Uint8Array([5, 6, 7, 8])); controller.close() }
  })
  vi.stubGlobal('fetch', async () => new Response(body, { headers: { 'content-length': '8' } }))
  const engine = { request: async () => ({ status: 'redirect', url: 'https://example.com/media', filename: 'clip.mp4' }) } as unknown as CobaltEngine
  const downloads = new Downloads(testStore(records), engine, () => {}, 'ffmpeg')
  const id = downloads.submit('https://example.com/post', 'video')
  await waitFor(() => (records.get(id)?.bytesReceived || 0) >= 4)
  downloads.action(id, 'pause')
  releaseSecond()
  await new Promise(resolve => setTimeout(resolve, 40))
  expect(records.get(id)?.state).toBe('paused')
  expect(records.get(id)?.bytesReceived).toBe(4)
  downloads.action(id, 'resume')
  await waitFor(() => records.get(id)?.state === 'completed')
  expect(records.get(id)?.bytesReceived).toBe(8)
})

it('cancels an active transfer and removes its temporary file', async () => {
  const records = new Map<string, Task>()
  let releaseSecond!: () => void
  const second = new Promise<void>(resolve => { releaseSecond = resolve })
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])) },
    async pull(controller) { await second; controller.enqueue(new Uint8Array([5, 6, 7, 8])); controller.close() }
  })
  vi.stubGlobal('fetch', async () => new Response(body))
  const engine = { request: async () => ({ status: 'redirect', url: 'https://example.com/media', filename: 'clip.mp4' }) } as unknown as CobaltEngine
  const downloads = new Downloads(testStore(records), engine, () => {}, 'ffmpeg')
  const id = downloads.submit('https://example.com/post', 'video')
  await waitFor(() => (records.get(id)?.bytesReceived || 0) >= 4)
  downloads.action(id, 'cancel')
  releaseSecond()
  await waitFor(() => !downloads.busy())
  expect(records.get(id)?.state).toBe('canceled')
  expect(readdirSync(folder)).toEqual([])
})

it('keeps two concurrent downloads with the same filename', async () => {
  const records = new Map<string, Task>()
  const states: string[] = []
  const store = {
    saveTask(task: Task) { records.set(task.id, structuredClone(task)) },
    getTask(id: string) { return records.get(id) },
    tasks() { return [...records.values()] },
    getPreferences() { return { downloadDirectory: folder, videoQuality: 'max', audioFormat: 'best', reducedMotion: false, locale: 'system', tutorialSeenVersion: 0 } }
  } as unknown as Store
  const engine = { request: async () => ({ status: 'redirect', url: 'data:text/plain,media', filename: 'same-name.mp4' }) } as unknown as CobaltEngine
  const downloads = new Downloads(store, engine, task => states.push(task.state), 'ffmpeg')
  downloads.submit('https://example.com/one', 'video')
  downloads.submit('https://example.com/two', 'video')
  await waitFor(() => records.size === 2 && [...records.values()].every(task => task.state === 'completed'))
  expect(readdirSync(folder).sort()).toEqual(['same-name (2).mp4', 'same-name.mp4'])
  expect(states).toContain('finalizing')
  expect(states.lastIndexOf('finalizing')).toBeLessThan(states.lastIndexOf('completed'))
})

it('saves each selected picker item as an independent completed file', async () => {
  const records = new Map<string, Task>()
  const preferences: Preferences = { downloadDirectory: folder, videoQuality: 'max', audioFormat: 'best', reducedMotion: false, locale: 'system', tutorialSeenVersion: 0 }
  const store = {
    saveTask(task: Task) { records.set(task.id, structuredClone(task)) },
    getTask(id: string) { return records.get(id) },
    deleteTask(id: string) { records.delete(id) },
    tasks() { return [...records.values()] },
    getPreferences() { return preferences }
  } as Store
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7Rm0AAAAASUVORK5CYII='
  const engine = { request: async () => ({ status: 'picker', picker: [{ type: 'photo', url: tinyPng }, { type: 'photo', url: tinyPng }] }) } as unknown as CobaltEngine
  const downloads = new Downloads(store, engine, () => {}, 'ffmpeg')
  const id = downloads.submit('https://example.com/album', 'video')
  await waitFor(() => records.get(id)?.state === 'choosing')
  downloads.select(id, [0, 1])
  await waitFor(() => records.size === 2 && [...records.values()].every(task => task.state === 'completed'))
  expect(readdirSync(folder).filter(name => name.endsWith('.jpg'))).toHaveLength(2)
  for (const task of records.values()) expect(task.outputPath && existsSync(task.outputPath)).toBe(true)
})

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 10_000
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for picker flow')
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}
