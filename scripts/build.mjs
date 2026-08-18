import { execFileSync } from 'node:child_process'
import { copyFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireFromRoot = createRequire(join(root, 'package.json'))

// Resolve tsc and tsdown from the plugin's own dependencies.
// We first try the standard require.resolve; if that lands on a parent
// workspace copy (pnpm monorepo), we fall back to the local .pnpm store path.
function resolveLocal(spec) {
  try {
    const resolved = requireFromRoot.resolve(spec)
    if (resolved.startsWith(root)) return resolved
  } catch {
    // fall through
  }
  // Find the package in the local .pnpm store
  const pnpmDir = join(root, 'node_modules', '.pnpm')
  const pkgName = spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0]
  const entries = readdirSync(pnpmDir, { withFileTypes: true })
  const match = entries
    .filter(e => e.isDirectory() && e.name.startsWith(pkgName + '@'))
    .sort((a, b) => b.name.localeCompare(a.name))[0]
  if (!match) throw new Error(`build: ${pkgName} not found in local .pnpm store`)
  const subpath = spec.startsWith('@')
    ? spec.split('/').slice(2).join('/')
    : spec.split('/').slice(1).join('/')
  return join(pnpmDir, match.name, 'node_modules', pkgName, subpath || '')
}

let tsc, tsdown
try {
  tsc = resolveLocal('typescript/lib/tsc.js')
  tsdown = resolveLocal('tsdown/dist/run.mjs')
} catch {
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

execFileSync(process.execPath, [tsdown, '--config', 'tsdown.config.mjs', '--config-loader', 'native', '--env.DSH_BUILD_FACE', 'host'], {
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
execFileSync(process.execPath, [tsdown, '--config', join(root, 'packages', clientPackage, 'tsdown.config.mjs'), '--config-loader', 'native'], {
  stdio: 'inherit',
  cwd: root,
})

console.log('build complete')
