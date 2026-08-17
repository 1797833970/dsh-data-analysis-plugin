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
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import * as DataAnalysis from '@andy1797833970/dsh-data-analysis'
import { SessionId } from '@deepseek-ai/dsh-session'

const HIGH = ReasoningEffortId('high')
const OFF = ReasoningEffortId('off')

/** Keyless adapter: load_table, set_route, save_chart, save_report, then answer. */
class DataAnalysisMockAdapter extends LlmAdapter {
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
      const args = JSON.stringify({ path: 'sales.csv', question: '帮我分析销售额' })
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: CallId('load-table'), name: 'load_table', argumentsDelta: args }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: CallId('load-table'), name: 'load_table', arguments: args } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const tool = this.step === 2
      ? { id: 'set-route', name: 'set_route', args: JSON.stringify({ route: 'viz' }) }
      : this.step === 3
        ? { id: 'save-chart', name: 'save_chart', args: JSON.stringify({ spec: { title: { text: '销售额' }, series: [{ type: 'bar', data: [120, 80] }] } }) }
        : { id: 'save-report', name: 'save_report', args: JSON.stringify({ markdown: '# 分析报告\n\n销售额整体上升。' }) }
    if (this.step === 2 || this.step === 3 || this.step === 4) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: CallId(tool.id), name: tool.name, argumentsDelta: tool.args }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: CallId(tool.id), name: tool.name, arguments: tool.args } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const reply = 'analysis started'
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

describe('data-analysis keyless smoke', () => {
  it('registers the tools and appends analysis events through a mock-model turn', async () => {
    workdir = await mkdtemp(join(tmpdir(), 'dsh-data-analysis-'))
    ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(LocalFileSystem, { cwd: workdir })
    ctx.llm.registerAdapter(['mock'], new DataAnalysisMockAdapter())
    await ctx.plugin(DataAnalysis, {})

    const agent = ctx.agentLoop.create(SessionId('data-analysis-smoke'), { provider: 'mock', model: 'mock' })
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
    const loaded = events.find(event => event.type === 'analysis/loaded')
    const route = events.find(event => event.type === 'analysis/route')
    const chart = events.find(event => event.type === 'analysis/chart')
    const report = events.find(event => event.type === 'analysis/report')
    expect(loaded?.data).toMatchObject({ path: 'sales.csv', format: 'csv', autoMode: false, question: '帮我分析销售额' })
    expect(route?.data).toEqual({ route: 'viz' })
    expect(chart?.data).toMatchObject({ title: '销售额' })
    expect(report?.data).toMatchObject({ markdown: '# 分析报告\n\n销售额整体上升。' })
  }, 60_000)
})
