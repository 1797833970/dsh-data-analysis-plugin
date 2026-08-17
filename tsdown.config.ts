import { defineConfig } from 'tsdown'

// Host build only. The deferred web chart-node package is not part of v1.
export default defineConfig({
  workspace: ['packages/code-runtime/*', 'packages/data-analysis/*'],
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  external: [/^@deepseek-ai\//, /^@andy1797833970\//, /^node:/, /^zod$/],
})
