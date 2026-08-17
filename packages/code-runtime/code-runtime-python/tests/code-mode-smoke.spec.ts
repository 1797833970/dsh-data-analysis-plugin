import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  CallId, LlmAdapter, ReasoningEffortId, createUserMessage,
} from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import * as DataAnalysis from '@andy1797833970/dsh-data-analysis'
import { PythonCodeRuntime } from '../src/index.ts'
import { SessionId } from '@deepseek-ai/dsh-session'

const HIGH = ReasoningEffortId('high')
const OFF = ReasoningEffortId('off')

class PassThroughSandbox extends SandboxProvider {
  override confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function findPython(): string | undefined {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['-c', 'print(1)'], { encoding: 'utf8' })
    if (probe.status === 0) return command
  }
  return undefined
}

const python = findPython()

/** Keyless adapter: one run_code program that reaches the analysis tools, then answer. */
class CodeModeMockAdapter extends LlmAdapter {
  private step = 0

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      reasoning: { efforts: [{ id: OFF, name: 'Off' }, { id: HIGH, name: 'High' }], defaultEffort: HIGH },
    }
  }

  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.step += 1
    if (this.step === 1) {
      const program = [
        'await tools.load_table({"path": "sales.csv", "question": "分析销售额"})',
        'await tools.save_chart({"spec": {"title": {"text": "销售额"}, "series": [{"type": "bar", "data": [120, 80]}]}})',
        'await tools.save_report({"markdown": "# 分析报告"})',
        'return {"ok": True}',
      ].join('\n')
      const args = JSON.stringify({ code: program, description: '分析销售额' })
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: CallId('run-code'), name: 'run_code', argumentsDelta: args }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: CallId('run-code'), name: 'run_code', arguments: args } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const reply = 'analysis complete'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: reply }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

let ctx: Context | undefined
let workdir: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  if (workdir !== undefined) await rm(workdir, { recursive: true, force: true })
  workdir = undefined
})

describe.skipIf(python === undefined)('code-mode smoke', () => {
  it('runs Python through run_code and reaches the analysis tools', async () => {
    workdir = await mkdtemp(join(tmpdir(), 'dsh-code-mode-'))
    ctx = new Context()
    await mountAgentLoopTestDependencies(ctx, { tools: { mode: 'code' } })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(PassThroughSandbox)
    await ctx.plugin(SandboxPolicyService, { mode: 'danger-full-access', workspaceRoot: workdir })
    await ctx.plugin(LocalFileSystem, { cwd: workdir })
    await ctx.plugin(PythonCodeRuntime, { pythonCommand: python as string })
    ctx.llm.registerAdapter(['mock'], new CodeModeMockAdapter())
    await ctx.plugin(DataAnalysis, {})

    const agent = ctx.agentLoop.create(SessionId('code-mode-smoke'), { provider: 'mock', model: 'mock' })
    agent.followup(createUserMessage({
      content: [{ type: 'text', text: '帮我分析销售额' }],
      source: { kind: 'user' },
    }))
    await new Promise<void>((resolve) => {
      const dispose = ctx!.on('agent/status', ({ agent: subject, status }) => {
        if (subject === agent && status === 'idle') {
          dispose()
          resolve()
        }
      })
    })

    const events = [...agent.session.events]
    expect(events.some(event => event.type === 'analysis/loaded')).toBe(true)
    expect(events.some(event => event.type === 'analysis/chart')).toBe(true)
    expect(events.some(event => event.type === 'analysis/report')).toBe(true)
  }, 60_000)
})
