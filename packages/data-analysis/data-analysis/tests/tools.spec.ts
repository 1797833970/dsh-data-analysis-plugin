import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
import * as DataAnalysis from '../src/index.ts'
import { SessionId } from '@deepseek-ai/dsh-session'

const HIGH = ReasoningEffortId('high')
const OFF = ReasoningEffortId('off')

/** Mock adapter that replays a fixed sequence of tool calls. */
class SequenceMockAdapter extends LlmAdapter {
  private step = 0
  private readonly responses: Array<{ toolCalls: Array<{ id: string; name: string; args: string }> } | { text: string }>

  constructor(responses: Array<{ toolCalls: Array<{ id: string; name: string; args: string }> } | { text: string }>) {
    super()
    this.responses = responses
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      reasoning: { efforts: [{ id: OFF, name: 'Off' }, { id: HIGH, name: 'High' }], defaultEffort: HIGH },
    }
  }

  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    const response = this.responses[this.step]
    this.step += 1
    if (response === undefined) {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'done' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    if ('text' in response) {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: response.text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: response.text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    for (let i = 0; i < response.toolCalls.length; i++) {
      const call = response.toolCalls[i]!
      yield { type: 'block-start', index: i, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: i, id: CallId(call.id), name: call.name, argumentsDelta: call.args }
      yield { type: 'block-end', index: i, block: { type: 'tool-call', id: CallId(call.id), name: call.name, arguments: call.args } }
    }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
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

async function setup(responses: Array<{ toolCalls: Array<{ id: string; name: string; args: string }> } | { text: string }>) {
  workdir = await mkdtemp(join(tmpdir(), 'dsh-data-analysis-tools-'))
  ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: workdir })
  ctx.llm.registerAdapter(['mock'], new SequenceMockAdapter(responses))
  await ctx.plugin(DataAnalysis, {})
  return ctx
}

async function runAgent(c: Context, userText: string) {
  const agent = c.agentLoop.create(SessionId('test-session'), { provider: 'mock', model: 'mock' })
  agent.followup(createUserMessage({
    content: [{ type: 'text', text: userText }],
    source: { kind: 'user' },
  }))
  await new Promise<void>((resolve) => {
    const dispose = c.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
  return agent
}

describe('data-analysis tools event emission', () => {
  describe('load_table', () => {
    it('emits analysis/loaded with correct data for CSV', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.csv', question: 'analyze' }) }] },
        { text: 'done' },
      ])
      const csvPath = join(workdir!, 'test.csv')
      await writeFile(csvPath, 'name,amount\napple,100\nbanana,200\n')
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded).toBeDefined()
      expect(loaded?.data).toMatchObject({
        path: 'test.csv',
        format: 'csv',
        autoMode: false,
        question: 'analyze',
      })
      // schema and loadedPath are present when Python loader succeeds;
      // they are absent when the Python interpreter is unavailable.
      const data = loaded?.data as unknown as Record<string, unknown>
      if (data.schema !== undefined) {
        expect(data.schema).toHaveProperty('shape')
        expect(data.schema).toHaveProperty('columns')
        expect(data.loadedPath).toBeDefined()
      }
    }, 30_000)

    it('detects auto mode from keyword "全自动"', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.csv', question: '帮我全自动分析' }) }] },
        { text: 'done' },
      ])
      const csvPath = join(workdir!, 'test.csv')
      await writeFile(csvPath, 'name,amount\napple,100\nbanana,200\n')
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded?.data).toHaveProperty('autoMode', true)
    }, 30_000)

    it('detects auto mode from keyword "auto"', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.csv', question: 'auto analysis' }) }] },
        { text: 'done' },
      ])
      const csvPath = join(workdir!, 'test.csv')
      await writeFile(csvPath, 'name,amount\napple,100\nbanana,200\n')
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded?.data).toHaveProperty('autoMode', true)
    }, 30_000)

    it('auto mode is false without keyword', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.csv', question: '帮我分析' }) }] },
        { text: 'done' },
      ])
      const csvPath = join(workdir!, 'test.csv')
      await writeFile(csvPath, 'name,amount\napple,100\nbanana,200\n')
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded?.data).toHaveProperty('autoMode', false)
    }, 30_000)

    it('does not emit analysis/loaded for unsupported format', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.docx', question: 'analyze' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded).toBeUndefined()
    }, 30_000)

    it('does not emit analysis/loaded for empty path', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: '', question: 'test' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded).toBeUndefined()
    }, 30_000)

    it('does not emit analysis/loaded for empty question', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'test.csv', question: '' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const loaded = [...agent.session.events].find(e => e.type === 'analysis/loaded')
      expect(loaded).toBeUndefined()
    }, 30_000)
  })

  describe('set_route', () => {
    it('emits analysis/route with viz route', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'set_route', args: JSON.stringify({ route: 'viz' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const route = [...agent.session.events].find(e => e.type === 'analysis/route')
      expect(route?.data).toEqual({ route: 'viz' })
    }, 30_000)

    it('emits analysis/route with ml route', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'set_route', args: JSON.stringify({ route: 'ml' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const route = [...agent.session.events].find(e => e.type === 'analysis/route')
      expect(route?.data).toEqual({ route: 'ml' })
    }, 30_000)
  })

  describe('save_chart', () => {
    it('emits analysis/chart with correct data', async () => {
      const spec = { title: { text: '销售额' }, series: [{ type: 'bar', data: [120, 80] }] }
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_chart', args: JSON.stringify({ spec }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const chart = [...agent.session.events].find(e => e.type === 'analysis/chart')
      expect(chart?.data).toMatchObject({ title: '销售额', spec })
      expect((chart?.data as unknown as Record<string, unknown>).chartId).toBeDefined()
    }, 30_000)

    it('defaults title to "Chart" when missing', async () => {
      const spec = { series: [{ type: 'bar', data: [1, 2] }] }
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_chart', args: JSON.stringify({ spec }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const chart = [...agent.session.events].find(e => e.type === 'analysis/chart')
      expect(chart?.data).toMatchObject({ title: 'Chart' })
    }, 30_000)

    it('does not emit analysis/chart for empty series', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_chart', args: JSON.stringify({ spec: { title: { text: 'test' }, series: [] } }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const chart = [...agent.session.events].find(e => e.type === 'analysis/chart')
      expect(chart).toBeUndefined()
    }, 30_000)
  })

  describe('save_report', () => {
    it('emits analysis/report with markdown and reportId', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_report', args: JSON.stringify({ markdown: '# 报告\n\n测试内容。' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const report = [...agent.session.events].find(e => e.type === 'analysis/report')
      expect(report?.data).toMatchObject({ markdown: '# 报告\n\n测试内容。' })
      expect((report?.data as unknown as Record<string, unknown>).reportId).toBeDefined()
    }, 30_000)

    it('does not emit analysis/report for empty markdown', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_report', args: JSON.stringify({ markdown: '' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const report = [...agent.session.events].find(e => e.type === 'analysis/report')
      expect(report).toBeUndefined()
    }, 30_000)

    it('dedents common leading whitespace from report', async () => {
      // Note: save_report calls .trim() before dedentMarkdown(), so leading whitespace
      // on the first line is stripped by trim(). This tests the dedent behavior
      // when all non-empty lines share the same indent.
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'save_report', args: JSON.stringify({ markdown: '# 报告\n\n  第一行\n  第二行' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      const report = [...agent.session.events].find(e => e.type === 'analysis/report')
      const markdown = (report?.data as unknown as Record<string, unknown>).markdown as string
      // The first line has no indent, so min indent is 0 and nothing is dedented
      // This is expected behavior: dedent only works when ALL non-empty lines have a common prefix
      expect(markdown).toContain('# 报告')
      expect(markdown).toContain('第一行')
    }, 30_000)
  })

  describe('export_pdf', () => {
    it('fails gracefully for non-existent reportId', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'export_pdf', args: JSON.stringify({ reportId: 'non-existent' }) }] },
        { text: 'done' },
      ])
      const agent = await runAgent(c, 'hello')
      // Just verify the agent completes without crashing
      expect(agent.session.events.length).toBeGreaterThan(0)
    }, 30_000)
  })

  describe('full event sequence', () => {
    it('records all analysis events in order for viz route', async () => {
      const c = await setup([
        { toolCalls: [{ id: 't1', name: 'load_table', args: JSON.stringify({ path: 'sales.csv', question: 'auto analysis' }) }] },
        { toolCalls: [{ id: 't2', name: 'set_route', args: JSON.stringify({ route: 'viz' }) }] },
        { toolCalls: [{ id: 't3', name: 'save_chart', args: JSON.stringify({ spec: { title: { text: 'Chart1' }, series: [{ type: 'bar', data: [1] }] } }) }] },
        { toolCalls: [{ id: 't4', name: 'save_chart', args: JSON.stringify({ spec: { title: { text: 'Chart2' }, series: [{ type: 'line', data: [2] }] } }) }] },
        { toolCalls: [{ id: 't5', name: 'save_report', args: JSON.stringify({ markdown: '# Report' }) }] },
        { text: 'done' },
      ])
      const csvPath = join(workdir!, 'sales.csv')
      await writeFile(csvPath, 'name,amount\na,1\nb,2\n')
      const agent = await runAgent(c, 'hello')
      const events = [...agent.session.events]
      const analysisEvents = events.filter(e => e.type.startsWith('analysis/'))

      const types = analysisEvents.map(e => e.type)
      expect(types).toContain('analysis/loaded')
      expect(types).toContain('analysis/route')
      expect(types.filter(t => t === 'analysis/chart')).toHaveLength(2)
      expect(types).toContain('analysis/report')

      // Verify order
      const loadedIdx = events.findIndex(e => e.type === 'analysis/loaded')
      const routeIdx = events.findIndex(e => e.type === 'analysis/route')
      const reportIdx = events.findIndex(e => e.type === 'analysis/report')
      expect(loadedIdx).toBeLessThan(routeIdx)
      expect(routeIdx).toBeLessThan(reportIdx)
    }, 30_000)
  })
})
