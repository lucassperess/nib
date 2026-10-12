import { afterEach, beforeEach, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { Downloads } from './downloads'
import type { Task } from '../shared/types'
import type { Store } from './store'
import type { MediaEngine } from './engine'
import type { Sessions } from './sessions'

const fakeCli = `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv;
if (args.at(-1).includes('/fail')) {
  process.stderr.write('ERROR: Unsupported URL\\n'); process.exit(1);
}
if (args.includes('--dump-single-json')) {
  process.stdout.write(JSON.stringify({ title: 'Clip', ext: 'mp4' }));
} else {
  const directory = args[args.indexOf('--paths') + 1];
  const output = args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
  fs.writeFileSync(path.join(directory, output), 'media');
  process.stdout.write('NIB_PROGRESS:5:5\\n');
}
`

let folder: string
beforeEach(() => { folder = mkdtempSync(join(tmpdir(), 'nib-engine-test-')) })
afterEach(() => {
  const within = relative(resolve(tmpdir()), resolve(folder))
  if (within.startsWith('..') || isAbsolute(within) || !within.startsWith('nib-engine-test-')) throw new Error('Unsafe test cleanup')
  rmSync(folder, { recursive: true, force: true })
})

function fixture(): { downloads: Downloads; records: Map<string, Task> } {
  const records = new Map<string, Task>()
  const store = {
    saveTask(task: Task) { records.set(task.id, structuredClone(task)) },
    getTask(id: string) { return records.get(id) },
    deleteTask(id: string) { records.delete(id) },
    tasks() { return [...records.values()] },
    getPreferences() { return { downloadDirectory: folder, videoQuality: 'max', audioFormat: 'best', reducedMotion: false, locale: 'system', tutorialSeenVersion: 0 } }
  } as Store
  const engine = { binary: process.execPath, commonArgs: () => ['-e', fakeCli, '--'] } as unknown as MediaEngine
  const sessions = { materializeFor: () => null } as unknown as Sessions
  return { records, downloads: new Downloads(store, engine, sessions, () => {}) }
}

it('saves a local media result and preserves an existing filename', async () => {
  const { downloads, records } = fixture()
  const first = downloads.submit('https://example.com/one', 'video')
  await waitFor(() => records.get(first)?.state === 'completed')
  const second = downloads.submit('https://example.com/two', 'video')
  await waitFor(() => records.get(second)?.state === 'completed')
  expect(readdirSync(folder).sort()).toEqual(['Clip (2).mp4', 'Clip.mp4'])
  expect(records.get(first)?.outputPath && existsSync(records.get(first)!.outputPath!)).toBe(true)
  expect(records.get(second)?.outputPath && existsSync(records.get(second)!.outputPath!)).toBe(true)
})

it('keeps a failed task removable without affecting completed downloads', async () => {
  const { downloads, records } = fixture()
  const good = downloads.submit('https://example.com/good', 'video')
  await waitFor(() => records.get(good)?.state === 'completed')
  const failed = downloads.submit('https://example.com/fail', 'video')
  await waitFor(() => records.get(failed)?.state === 'failed')
  expect(records.get(failed)?.errorCode).toBe('media.unsupported')
  downloads.action(failed, 'remove')
  expect(records.has(failed)).toBe(false)
  expect(records.get(good)?.outputPath && existsSync(records.get(good)!.outputPath!)).toBe(true)
})

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 10_000
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for local engine')
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}
