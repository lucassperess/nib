import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join, relative, isAbsolute } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const upstream = join(root, 'vendor', 'cobalt')
const target = join(root, '.bundle', 'cobalt-api')
const runtime = join(root, '.runtime')
if (!existsSync(join(upstream, 'api', 'src', 'cobalt.js'))) throw new Error('Initialize the Cobalt submodule first')
const commit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const expected = 'a636575b09de1fc55d9b8cd98cac88f5f2f16b42'
if (commit !== expected) throw new Error(`Unexpected Cobalt commit: ${commit}`)
const workspaceConfig = join(upstream, 'pnpm-workspace.yaml')
const originalConfig = readFileSync(workspaceConfig, 'utf8')
const approved = `${originalConfig.replace(/\nallowBuilds:[\s\S]*$/,'').trimEnd()}\nallowBuilds:\n  esbuild: true\n  ffmpeg-static: true\n  isolated-vm: true\n  svelte-preprocess: true\n  syscall-napi: false\n`
const runPnpm = args => {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(command, args, { cwd: upstream, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed`)
}
try {
  writeFileSync(workspaceConfig, approved)
  runPnpm(['install', '--frozen-lockfile'])
  if (existsSync(target)) {
    const candidate = resolve(target)
    const within = relative(root, candidate)
    if (within.startsWith('..') || isAbsolute(within) || within === '') throw new Error('Refusing to remove a path outside Nib')
    rmSync(candidate, { recursive: true, force: true })
  }
  runPnpm(['--config.force-legacy-deploy=true', '--filter', '@imput/cobalt-api', 'deploy', '--prod', '--no-optional', target])
} finally {
  writeFileSync(workspaceConfig, originalConfig)
}
const versionModule = join(target, 'node_modules', '@imput', 'version-info', 'index.js')
// pnpm deploy hard-links package files. Unlink before replacing so the pinned upstream checkout is untouched.
rmSync(versionModule)
writeFileSync(versionModule, `export const getCommit = async () => '${commit}';\nexport const getBranch = async () => 'main';\nexport const getRemote = async () => 'imputnet/cobalt';\nexport const getVersion = async () => '11.7.1';\n`)
const watcherModule = join(target, 'src', 'misc', 'file-watcher.js')
let watcherSource = readFileSync(watcherModule, 'utf8')
watcherSource = watcherSource.replace("import * as fs from 'node:fs/promises';", "import * as fs from 'node:fs/promises';\nimport { fileURLToPath } from 'node:url';")
watcherSource = watcherSource.replace(/const pathname = url\.pathname === '\/' \? '' : url\.pathname;\s*const file_path = decodeURIComponent\(url\.host \+ pathname\);/, 'const file_path = fileURLToPath(url);')
rmSync(watcherModule)
writeFileSync(watcherModule, watcherSource)
const links = []
function collectLinks(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      let destination = resolve(directory, readlinkSync(path))
      if (destination === join(upstream, 'api')) destination = target
      const relativeDestination = relative(target, destination)
      if (relativeDestination.startsWith('..') || isAbsolute(relativeDestination)) throw new Error(`External Cobalt link: ${path}`)
      links.push({ path: relative(target, path), target: relativeDestination })
    } else if (stat.isDirectory()) collectLinks(path)
  }
}
collectLinks(target)
writeFileSync(join(target, 'nib-links.json'), JSON.stringify(links))
mkdirSync(runtime, { recursive: true })
if (process.platform === 'win32') copyFileSync(process.execPath, join(runtime, 'node.exe'))
console.log(`Prepared Cobalt ${commit.slice(0, 8)} and local Node runtime.`)
await import('./materialize-cobalt.mjs')
