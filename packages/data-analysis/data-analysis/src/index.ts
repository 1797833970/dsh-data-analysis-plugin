/**
 * Model-facing data-analysis tools plus the `analysisState` projection. Each
 * tool appends one `analysis/*` session event so the wizard state stays
 * replayable and model-visible facts remain logged. The analysis is otherwise
 * model-driven in Code Mode; these tools own the deterministic boundaries.
 * @module @andy1797833970/dsh-data-analysis
 */

import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-fs'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { AnalysisLoaded, AnalysisReport, AnalysisState } from './types.ts'

// Re-export the type face so host programs receive the `analysis/*` event and
// `analysisState` projection declarations through this package root.
export type * from './types.ts'

export const name = 'data-analysis'
export const inject = ['tools', 'subprocess', 'fs']

/** Model-facing data-analysis tool configuration. */
export interface Config {
  /** Lowercase file extensions (with dot) `load_table` accepts. */
  supportedExtensions?: string[]
  /** Keywords that select run-to-completion auto mode. */
  autoModeKeywords?: string[]
  /** Maximum accepted question length in characters. */
  maxQuestionLength?: number
  /** Python executable used by table loading and `export_pdf`; defaults to `DSH_PYTHON`, then the platform default. */
  pdfPythonCommand?: string
  /** Wall-clock budget for one PDF render before the render is aborted. */
  pdfTimeoutMs?: number
}

/** Schemastery configuration for the data-analysis consumer. */
export const Config: z<Config> = z.object({
  supportedExtensions: z.array(z.string()).default(['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json', '.parquet']),
  autoModeKeywords: z.array(z.string()).default(['全自动', '自动分析', '自动跑', 'auto']),
  maxQuestionLength: z.number().default(2000),
  pdfPythonCommand: z.string().default(process.env.DSH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')),
  pdfTimeoutMs: z.number().default(30_000),
})

/** Wire payload schema of the `analysisState` projection. */
const analysisStateSchema: ZodType<AnalysisState> = zod.object({
  loadedPath: zod.string().nullable(),
  autoMode: zod.boolean(),
  route: zod.union([zod.literal('viz'), zod.literal('ml')]).nullable(),
  charts: zod.array(zod.object({
    chartId: zod.string(),
    title: zod.string(),
  })),
  reportId: zod.string().nullable(),
})

/** Escape text for the HTML report fallback. */
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Remove the common leading whitespace from a model-written Markdown report. */
function dedentMarkdown(text: string): string {
  const lines = text.replace(/^\n+|\n+$/g, '').split('\n')
  const indents = lines
    .filter(line => line.trim().length > 0)
    .map(line => /^[ \t]*/.exec(line)?.[0].length ?? 0)
  if (indents.length === 0) return lines.join('\n')
  const minIndent = Math.min(...indents)
  if (minIndent === 0) return lines.join('\n')
  return lines.map(line => line.slice(minIndent)).join('\n')
}

/** Render Markdown to a printable HTML document without external dependencies. */
function renderReportHtml(markdown: string): string {
  const body: string[] = []
  let inCode = false
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      inCode = !inCode
      body.push(inCode ? '<pre><code>' : '</code></pre>')
      continue
    }
    if (inCode) {
      body.push(escapeHtml(line))
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]?.length ?? 1
      body.push(`<h${level}>${escapeHtml(heading[2] ?? '')}</h${level}>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      body.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    if (line.trim().length === 0) continue
    body.push(`<p>${escapeHtml(line)}</p>`)
  }
  return `<html><head><meta charset="utf-8"><title>Analysis report</title></head><body>${body.join('')}</body></html>`
}

/**
 * Dedicated Markdown→PDF renderer run outside the model-facing code runtime,
 * so its trusted imports (`markdown`, `xhtml2pdf`, `io`) are not subject to the
 * model program's import guard. Reads Markdown from stdin and writes PDF bytes
 * to stdout; a nonzero exit means the renderer is unavailable and the caller
 * falls back to the HTML companion.
 */
const PDF_SCRIPT = String.raw`import sys


def main():
    markdown = sys.stdin.read()
    try:
        import markdown as md
        body = md.markdown(markdown, extensions=['tables', 'fenced_code'])
    except Exception:
        body = '<pre>' + markdown.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') + '</pre>'
    html = ('<html><head><meta charset="utf-8">'
            '<style>body{font-family:sans-serif;font-size:12px;line-height:1.6}'
            'table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}'
            'code{background:#f5f5f5;padding:1px 4px;border-radius:3px}'
            'h1,h2,h3{margin-top:1.2em}</style></head>'
            '<body>' + body + '</body></html>')
    try:
        from xhtml2pdf import pisa
        import io
        buffer = io.BytesIO()
        result = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')
        if result.err:
            raise RuntimeError('xhtml2pdf conversion failed')
        sys.stdout.buffer.write(buffer.getvalue())
        sys.stdout.buffer.flush()
    except Exception as exc:
        sys.stderr.write('pdf renderer unavailable: ' + str(exc))
        sys.exit(2)


main()
`

/**
 * Dedicated table loader run outside the model-facing code runtime: reads any
 * supported tabular format with robust encoding/delimiter handling, writes a
 * canonical parquet, and prints a structured schema summary.
 */
const LOAD_SCRIPT = String.raw`import csv
import io
import json
import sys

import pandas as pd

_ENCODINGS = ('utf-8-sig', 'utf-8', 'gb18030', 'big5', 'utf-16', 'latin-1')
_DELIMITERS = ',;\\t| '


def _decode(raw):
    for encoding in _ENCODINGS:
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return raw.decode('utf-8', errors='replace')


def _read_delimited(path):
    with open(path, 'rb') as handle:
        raw = handle.read()
    text = _decode(raw)
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=_DELIMITERS)
        separator = dialect.delimiter
    except csv.Error:
        separator = ','
    return pd.read_csv(io.StringIO(text), sep=separator)


def _read_table(path):
    lower = path.lower()
    if lower.endswith(('.xlsx', '.xls', '.xlsm')):
        return pd.read_excel(path)
    if lower.endswith('.json'):
        return pd.read_json(path)
    if lower.endswith(('.parquet', '.pq')):
        return pd.read_parquet(path)
    return _read_delimited(path)


def main():
    path, parquet_out = sys.argv[1], sys.argv[2]
    df = _read_table(path)
    df.to_parquet(parquet_out, engine='pyarrow')
    schema = {
        'shape': [int(df.shape[0]), int(df.shape[1])],
        'columns': [{'name': str(c), 'dtype': str(df[c].dtype)} for c in df.columns],
        'missing': int(df.isna().sum().sum()),
        'duplicated': int(df.duplicated().sum()),
    }
    print(json.dumps(schema, ensure_ascii=False))

main()
`

/** Find the last saved report with the requested id, or `undefined`. */
function findReport(events: readonly { type: string; data: unknown }[], reportId: string): AnalysisReport | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type === 'analysis/report' && (event.data as AnalysisReport).reportId === reportId) {
      return event.data as AnalysisReport
    }
  }
  return undefined
}

/** Render one report to PDF bytes, or `undefined` when the renderer is unavailable. */
async function renderPdfBytes(
  ctx: Context,
  markdown: string,
  pythonCommand: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  workspaceRoot: string,
): Promise<Uint8Array | undefined> {
  let proc: SubprocessHandle
  try {
    proc = ctx.subprocess.spawn({
      argv: [pythonCommand, '-u', '-c', PDF_SCRIPT],
      cwd: workspaceRoot,
      stdio: { stdin: { data: markdown }, stdout: 'pipe', stderr: 'pipe' },
      graceMs: 5_000,
      signal,
    })
  } catch {
    return undefined
  }
  const chunks: Buffer[] = []
  proc.stdout?.on('data', (chunk: Buffer) => { chunks.push(chunk) })
  const timer = setTimeout(() => { proc.terminate() }, timeoutMs)
  try {
    const outcome = await proc.done
    if (outcome.exitCode !== 0) return undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
  const bytes = Buffer.concat(chunks)
  return bytes.length > 0 ? bytes : undefined
}

/**
 * Load one tabular file through the robust Python reader and return its schema,
 * or `undefined` when the loader is unavailable.
 */
async function loadTableSchema(
  ctx: Context,
  path: string,
  parquetOut: string,
  pythonCommand: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  workspaceRoot: string,
): Promise<Record<string, JsonValue> | undefined> {
  const proc = ctx.subprocess.spawn({
    argv: [pythonCommand, '-u', '-c', LOAD_SCRIPT, path, parquetOut],
    cwd: workspaceRoot,
    stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
    graceMs: 5_000,
    signal,
  })
  let output = ''
  proc.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString('utf8') })
  const timer = setTimeout(() => { proc.terminate() }, timeoutMs)
  try {
    const outcome = await proc.done
    if (outcome.exitCode !== 0) return undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
  try {
    return JSON.parse(output.trim()) as Record<string, JsonValue>
  } catch {
    return undefined
  }
}

/**
 * Register the data-analysis tools on `ctx.tools` and, when the
 * session-projection seam is composed, the `analysisState` unit.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - deployment's explicit data-analysis policy.
 */
export function apply(ctx: Context, config: Config): void {
  const policy = {
    supportedExtensions: config.supportedExtensions ?? ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json', '.parquet'],
    autoModeKeywords: config.autoModeKeywords ?? ['全自动', '自动分析', '自动跑', 'auto'],
    maxQuestionLength: config.maxQuestionLength ?? 2000,
    pdfPythonCommand: config.pdfPythonCommand ?? (process.env.DSH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')),
    pdfTimeoutMs: config.pdfTimeoutMs ?? 30_000,
  }
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'analysisState', AnalysisState>({
      key: 'analysisState',
      schema: analysisStateSchema,
      init: () => ({ loadedPath: null, autoMode: false, route: null, charts: [], reportId: null }),
      apply: (state, event) => {
        switch (event.type) {
          case 'analysis/loaded':
            return { ...state, loadedPath: event.data.path, autoMode: event.data.autoMode }
          case 'analysis/route':
            return { ...state, route: event.data.route }
          case 'analysis/chart':
            return { ...state, charts: [...state.charts, { chartId: event.data.chartId, title: event.data.title }] }
          case 'analysis/report':
            return { ...state, reportId: event.data.reportId }
          default:
            return state
        }
      },
      view: state => state,
      stateVersion: 1,
    })
  })

  ctx.tools.register(defineTool({
    name: 'load_table',
    description:
      'Register a workspace data file (CSV/TSV/TXT/XLSX/XLS/JSON/Parquet) as the analysis target. '
      + 'Returns the resolved format and whether the question selected auto mode. '
      + 'Read and explore the actual data with run_code afterwards.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute or workspace-relative path to the data file.',
      },
      question: {
        type: 'string',
        required: true,
        description: "The user's analysis question.",
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          format: { type: 'string', required: true },
          autoMode: { type: 'boolean', required: true },
          schema: { type: 'object', additionalProperties: true },
          loadedPath: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.schema === undefined
          ? `Registered ${value.path} (${value.format}); auto mode ${value.autoMode ? 'on' : 'off'}.`
          : `Loaded ${value.path} and parsed its schema; cleaned data at ${value.loadedPath ?? 'unknown'}.`,
      }],
    },
    async execute(args, exec) {
      const path = args.path.trim()
      if (path.length === 0) throw new Error('invalid path: expected a non-empty string')
      const question = args.question.trim()
      if (question.length === 0) throw new Error('invalid question: expected a non-empty string')
      if (question.length > policy.maxQuestionLength) throw new Error(`question exceeds ${policy.maxQuestionLength} characters`)
      const format = extname(path).replace(/^\./, '').toLowerCase()
      if (!policy.supportedExtensions.includes(`.${format}`)) throw new Error(`unsupported file format .${format}`)
      const autoMode = policy.autoModeKeywords.some(keyword => question.includes(keyword))
      if (!exec.agent) throw new Error('load_table requires an owning agent session')
      const workspaceRoot = exec.agent.session.header.cwd ?? process.cwd()
      const loadedPath = join(workspaceRoot, 'loaded.parquet')
      const schema = await loadTableSchema(
      ctx, path, loadedPath, policy.pdfPythonCommand, policy.pdfTimeoutMs, exec.signal, workspaceRoot,
      )
      const loaded: AnalysisLoaded = { path, format, autoMode, question, ...schema === undefined ? {} : { schema, loadedPath } }
      exec.agent.session.append('analysis/loaded', loaded)
      return schema === undefined ? { path, format, autoMode } : { path, format, autoMode, schema, loadedPath }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'set_route',
    description:
      'Fix the session analysis route after cleaning: viz (descriptive + visualization) '
      + 'or ml (feature construction + classification/regression).',
    parameters: {
      route: {
        type: 'string',
        required: true,
        enum: ['viz', 'ml'],
        description: 'The fixed route for the rest of this session.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          route: { type: 'string', required: true, enum: ['viz', 'ml'] },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Analysis route fixed to ${value.route}.` }],
    },
    execute(args, exec) {
      if (!exec.agent) throw new Error('set_route requires an owning agent session')
      const route = args.route
      exec.agent.session.append('analysis/route', { route })
      return Promise.resolve({ route })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_chart',
    description: 'Validate and persist one ECharts option object for UI rendering and the report.',
    parameters: {
      spec: {
        type: 'object',
        additionalProperties: true,
        required: true,
        description: 'An ECharts option object. It must include a non-empty series array.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chartId: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Saved chart ${value.title}.` }],
    },
    execute(args, exec) {
      const spec = args.spec as Record<string, unknown>
      const series = spec.series
      if (!Array.isArray(series) || series.length === 0) throw new Error('invalid chart: spec.series must be a non-empty array')
      const titleObject = spec.title as Record<string, unknown> | undefined
      const title = typeof titleObject?.text === 'string' && titleObject.text.length > 0 ? titleObject.text : 'Chart'
      const chartId = randomUUID()
      if (!exec.agent) throw new Error('save_chart requires an owning agent session')
      exec.agent.session.append('analysis/chart', { chartId, title, spec })
      return Promise.resolve({ chartId, title })
    },
    presentCall: args => ({ card: 'generic', title: 'Save chart', kind: 'other', rawInput: args.spec }),
  }))

  ctx.tools.register(defineTool({
    name: 'save_report',
    description: 'Validate and persist the final Markdown analysis report.',
    parameters: {
      markdown: {
        type: 'string',
        required: true,
        description: 'The complete Markdown report body.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportId: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Saved report ${value.reportId}.` }],
    },
    execute(args, exec) {
      const markdown = dedentMarkdown(args.markdown.trim())
      if (markdown.length === 0) throw new Error('invalid report: expected a non-empty markdown body')
      const reportId = randomUUID()
      if (!exec.agent) throw new Error('save_report requires an owning agent session')
      exec.agent.session.append('analysis/report', { reportId, markdown })
      return Promise.resolve({ reportId })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'export_pdf',
    description:
      'Render a saved report to PDF plus a printable HTML companion. When the '
      + 'configured Python renderer is unavailable, the HTML is still returned and '
      + 'pdfPath is omitted.',
    parameters: {
      reportId: {
        type: 'string',
        required: true,
        description: 'The report id returned by save_report.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportId: { type: 'string', required: true },
          html: { type: 'string', required: true },
          pdfPath: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.pdfPath === undefined
          ? `Rendered report ${value.reportId} to HTML (PDF renderer unavailable).`
          : `Rendered report ${value.reportId} to ${value.pdfPath}.`,
      }],
    },
    async execute(args, exec) {
      if (!exec.agent) throw new Error('export_pdf requires an owning agent session')
      const report = findReport(exec.agent.session.events, args.reportId)
      if (report === undefined) throw new Error(`report ${args.reportId} not found`)
      const html = renderReportHtml(report.markdown)
      const workspaceRoot = exec.agent.session.header.cwd ?? process.cwd()
      const bytes = await renderPdfBytes(ctx, report.markdown, policy.pdfPythonCommand, policy.pdfTimeoutMs, exec.signal, workspaceRoot)
      if (bytes === undefined) return { reportId: args.reportId, html }
      const pdfPath = join(workspaceRoot, `report-${args.reportId}.pdf`)
      await writeFile(pdfPath, bytes)
      return { reportId: args.reportId, html, pdfPath }
    },
  }))
}
