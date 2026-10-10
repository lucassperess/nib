import { cp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const project = resolve(import.meta.dirname, '..')
const source = join(project, '.bundle', 'cobalt-api')
const destination = join(project, '.bundle', 'cobalt-runtime')
const inside = relative(project, destination)
if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('Invalid Cobalt runtime destination')
if (!existsSync(join(source, 'nib-links.json'))) throw new Error('Prepare Cobalt before materializing it')
await rm(destination, { recursive: true, force: true })
const poolPrefix = `node_modules${sep}.pnpm${sep}node_modules${sep}`
const rootPrefix = `node_modules${sep}`
await cp(source, destination, {
  recursive: true,
  filter: async path => {
    const name = relative(source, path)
    return !name.startsWith(`node_modules${sep}.pnpm${sep}`) && name !== `node_modules${sep}.pnpm` && !(await lstat(path)).isSymbolicLink()
  }
})
const links = JSON.parse(await readFile(join(source, 'nib-links.json'), 'utf8'))
const direct = links.filter(link => link.target && link.path.startsWith(rootPrefix) && !link.path.startsWith(`node_modules${sep}.pnpm${sep}`))
const hoisted = links.filter(link => link.target && link.path.startsWith(poolPrefix))
const copyPackage = async (target, path) => {
  const targetPath = join(source, target)
  const withinSource = relative(source, targetPath)
  if (!withinSource || withinSource.startsWith('..') || isAbsolute(withinSource)) throw new Error(`Invalid Cobalt dependency: ${target}`)
  await mkdir(dirname(path), { recursive: true })
  await cp(targetPath, path, { recursive: true, filter: async file => !(await lstat(file)).isSymbolicLink() })
}
const entries = [
  ...direct.map(link => ({ target: link.target, destination: link.path })),
  ...hoisted.map(link => ({ target: link.target, destination: join('node_modules', link.path.slice(poolPrefix.length)) }))
]
const queue = [...entries]
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const entry = queue.shift()
    const path = join(destination, entry.destination)
    if (!existsSync(path)) await copyPackage(entry.target, path)
  }
}))
const rootTargets = new Map(hoisted.map(link => [link.path.slice(poolPrefix.length), link.target]))
for (const link of direct) rootTargets.set(link.path.slice(rootPrefix.length), link.target)
const nested = []
function planDependencies(packageTarget, packageDestination, visible) {
  const virtualBase = packageTarget.match(/^node_modules\\\.pnpm\\[^\\]+\\node_modules\\/)?.[0]
  if (!virtualBase) return
  for (const dependency of links) {
    if (!dependency.target || !dependency.path.startsWith(virtualBase)) continue
    const name = dependency.path.slice(virtualBase.length)
    if (visible.get(name) === dependency.target) continue
    const nestedDestination = join(packageDestination, 'node_modules', name)
    nested.push({ target: dependency.target, destination: nestedDestination })
    const nextVisible = new Map(visible)
    nextVisible.set(name, dependency.target)
    planDependencies(dependency.target, nestedDestination, nextVisible)
  }
}
for (const [name, target] of rootTargets) if (target) planDependencies(target, join('node_modules', name), rootTargets)
for (const entry of nested) await copyPackage(entry.target, join(destination, entry.destination))
await writeFile(join(destination, '.nib-ready'), 'materialized at build time')
console.log(`Materialized ${entries.length} root dependencies and ${nested.length} nested dependencies.`)
