import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesRoot = join(root, 'packages')

for (const group of readdirSync(packagesRoot)) {
  const groupDir = join(packagesRoot, group)
  if (!statSync(groupDir).isDirectory()) continue
  for (const pkg of readdirSync(groupDir)) {
    const libDir = join(groupDir, pkg, 'lib')
    if (existsSync(libDir)) rmSync(libDir, { recursive: true, force: true })
  }
}
console.log(`clean: removed package lib outputs under ${root}`)
