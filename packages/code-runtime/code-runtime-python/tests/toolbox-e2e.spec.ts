import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SHIM_SOURCE } from '../src/index.ts'

/** First Python interpreter on PATH that imports pandas, or undefined. */
function pythonWithPandas(): string | undefined {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['-c', 'import pandas'], { encoding: 'utf8' })
    if (probe.status === 0) return command
  }
  return undefined
}

const python = pythonWithPandas()

describe.skipIf(python === undefined)('python toolbox end-to-end', () => {
  it('imports the shipped toolbox and returns a lossless JSON value', () => {
    const toolboxParent = fileURLToPath(new URL('../../../data-analysis/skill-data-analysis', import.meta.url))
    const program = [
      'import pandas as pd',
      'from toolbox.eda import correlation_matrix',
      "df = pd.DataFrame({'a':[1,2,3],'b':[2,4,6]})",
      "return {'ok': True, 'cols': list(df.columns), 'corr': correlation_matrix(df).round(1).to_dict()}",
    ].join('\n')
    const boot = JSON.stringify({
      program,
      bindings: [],
      allowedModules: ['pandas', 'toolbox'],
      toolboxDirs: [toolboxParent],
      maxOutputBytes: 100000,
    })
    const run = spawnSync(python as string, ['-u', '-c', SHIM_SOURCE], {
      input: `${boot}\n`,
      encoding: 'utf8',
      maxBuffer: 10_000_000,
    })
    expect(run.status, run.stderr).toBe(0)
    interface ShimLine { readonly op: string; readonly value?: unknown }
    const done = run.stdout
      .split('\n')
      .map((line): ShimLine | null => { try { return JSON.parse(line) as ShimLine } catch { return null } })
      .find((line): line is ShimLine => line !== null && line.op === 'done')
    expect(done?.value).toMatchObject({ ok: true, cols: ['a', 'b'] })
  })
})
