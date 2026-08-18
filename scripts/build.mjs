import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tsc = join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')
const tsdown = join(root, 'node_modules', 'tsdown', 'dist', 'run.mjs')

if (!existsSync(tsc) || !existsSync(tsdown)) {
  throw new Error('build: run `pnpm install` first; typescript/tsdown must be installed')
}

const hostPackages = [
  'code-runtime/code-runtime-python',
  'data-analysis/data-analysis',
  'data-analysis/skill-data-analysis',
  'data-analysis/bundle-data-analysis',
]

for (const pkg of hostPackages) {
  execFileSync(process.execPath, [tsc, '-p', join(root, 'packages', pkg, 'tsconfig.json')], {
    stdio: 'inherit',
    cwd: root,
  })
}

execFileSync(process.execPath, [tsdown, '--config', 'tsdown.config.ts', '--env.DSH_BUILD_FACE', 'host'], {
  stdio: 'inherit',
  cwd: root,
})

const clientPackage = 'client/ui-data-analysis'
execFileSync(process.execPath, [tsc, '-p', join(root, 'packages', clientPackage, 'tsconfig.json')], {
  stdio: 'inherit',
  cwd: root,
})
copyFileSync(
  join(root, 'packages', clientPackage, 'lib', 'types', 'index.js'),
  join(root, 'packages', clientPackage, 'lib', 'index.js'),
)
copyFileSync(
  join(root, 'packages', clientPackage, 'lib', 'types', 'invariant.js'),
  join(root, 'packages', clientPackage, 'lib', 'invariant.js'),
)
execFileSync(process.execPath, [tsc, '-p', join(root, 'packages', clientPackage, 'tsconfig.client.json')], {
  stdio: 'inherit',
  cwd: root,
})
execFileSync(process.execPath, [tsdown, '--config', join(root, 'packages', clientPackage, 'tsdown.config.ts')], {
  stdio: 'inherit',
  cwd: root,
})

console.log('build complete')
