import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { PythonCodeRuntime } from '../src/index.ts'

/** Pass-through sandbox: enough for the provider's inject contract. */
class PassThroughSandbox extends SandboxProvider {
  override confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

/** First Python interpreter on PATH, or undefined. */
function findPython(): string | undefined {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['-c', 'print(1)'], { encoding: 'utf8' })
    if (probe.status === 0) return command
  }
  return undefined
}

const python = findPython()

let ctx: Context | undefined
let workdir: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  if (workdir !== undefined) await rm(workdir, { recursive: true, force: true })
  workdir = undefined
})

describe.skipIf(python === undefined)('PythonCodeRuntime', () => {
  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'dsh-python-runtime-'))
    ctx = new Context()
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(PassThroughSandbox)
    await ctx.plugin(SandboxPolicyService, { mode: 'danger-full-access', workspaceRoot: workdir })
    await ctx.plugin(PythonCodeRuntime, { pythonCommand: python as string })
  })

  it('runs a program through a real subprocess and returns its value', async () => {
    const result = await ctx!.codeRuntime.run({
      program: "print('hello')\nreturn 6 * 7",
      bindings: [],
    })
    expect(result.error, JSON.stringify(result)).toBeUndefined()
    expect(result.logs).toEqual(['hello'])
    expect(result.value).toBe(42)
  }, 30_000)

  it('allows getattr for ordinary attribute access', async () => {
    const result = await ctx!.codeRuntime.run({
      program: "return getattr({'a': 1}, 'get', None) is not None",
      bindings: [],
    })
    expect(result.value).toBe(true)
  }, 30_000)

  it('blocks getattr toward a forbidden attribute name', async () => {
    const result = await ctx!.codeRuntime.run({
      program: "return getattr({}, '__globals__', None)",
      bindings: [],
    })
    expect(result.error?.kind).toBe('exception')
  }, 30_000)

  it('allows harmless stdlib imports such as asyncio and io', async () => {
    const result = await ctx!.codeRuntime.run({
      program: 'import asyncio\nimport io\nreturn bool(asyncio) and bool(io)',
      bindings: [],
    })
    expect(result.value).toBe(true)
  }, 30_000)
})
