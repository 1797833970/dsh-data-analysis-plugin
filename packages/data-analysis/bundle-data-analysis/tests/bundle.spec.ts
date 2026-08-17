/**
 * The data-analysis bundle's substance is its patch: it must parse and mount
 * the three host plugins without hardcoding a workspace-relative toolbox path.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

interface PatchRow {
  readonly id?: string
  readonly config?: Record<string, unknown>
}

function rowsOf(): PatchRow[] {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const parsed = yaml.load(
    readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'),
    { schema: entryListSchema },
  )
  if (!Array.isArray(parsed)) throw new TypeError('bundle patch must parse to a patch list')
  return parsed.flatMap(patch => (patch as { insert?: PatchRow[] }).insert ?? [])
}

describe('dsh-bundle-data-analysis bundle', () => {
  it('mounts the three host plugins', () => {
    const ids = rowsOf().map(row => row.id)
    expect(ids).toContain('code-runtime-python')
    expect(ids).toContain('data-analysis')
    expect(ids).toContain('skill-data-analysis')
  })

  it('does not hardcode a toolbox directory', () => {
    const runtime = rowsOf().find(row => row.id === 'code-runtime-python')
    expect(runtime).toBeDefined()
    expect(runtime?.config?.['toolboxDirs']).toBeUndefined()
  })

  it('keeps the loader self-contained and accepts parquet input', () => {
    const analysis = rowsOf().find(row => row.id === 'data-analysis')
    expect(analysis).toBeDefined()
    expect(analysis?.config?.['toolboxDir']).toBeUndefined()
    const extensions = analysis?.config?.['supportedExtensions']
    expect(Array.isArray(extensions)).toBe(true)
    expect(extensions).toContain('.parquet')
  })
})
