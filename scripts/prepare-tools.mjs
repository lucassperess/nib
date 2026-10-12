import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ffmpeg from 'ffmpeg-static'

const root = resolve(import.meta.dirname, '..')
const runtime = join(root, '.runtime')
const version = '2026.10.10.233141'
const expected = 'e7cafc44db8aa433da8dd78303b9157f2c1dd509c4cbfcd8418081b7e1d26a7a'
const binary = join(runtime, 'yt-dlp.exe')
const sha256 = data => createHash('sha256').update(data).digest('hex')

await mkdir(runtime, { recursive: true })
if (!existsSync(binary) || sha256(await readFile(binary)) !== expected) {
  const url = `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/download/${version}/yt-dlp.exe`
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`Could not fetch the pinned yt-dlp binary: HTTP ${response.status}`)
  const data = Buffer.from(await response.arrayBuffer())
  if (sha256(data) !== expected) throw new Error('Pinned yt-dlp checksum mismatch')
  const pending = `${binary}.download`
  try { await writeFile(pending, data); await rename(pending, binary) }
  finally { await rm(pending, { force: true }) }
}
if (!ffmpeg || !existsSync(ffmpeg)) throw new Error('ffmpeg-static executable is missing')
await copyFile(ffmpeg, join(runtime, 'ffmpeg.exe'))
await copyFile(process.execPath, join(runtime, 'node.exe'))
console.log(`Prepared yt-dlp ${version}, FFmpeg and Node for Nib.`)
