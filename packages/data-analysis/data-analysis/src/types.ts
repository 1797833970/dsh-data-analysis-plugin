/**
 * Pure types of the data-analysis domain: the one home of the `analysis/*`
 * session-event payloads and the `analysisState` projection-key declaration,
 * free of host-side value imports (dsh-tools, zod).
 *
 * @module @andy1797833970/dsh-data-analysis/types
 */

/** The two fixed analysis routes a session picks after cleaning. */
export type AnalysisRoute = 'viz' | 'ml'

/** Payload of the `analysis/loaded` session event. */
export interface AnalysisLoaded {
  /** Workspace path the agent is analysing. */
  readonly path: string
  /** Lowercase file extension without the leading dot. */
  readonly format: string
  /** Whether the initial question selected the run-to-completion auto mode. */
  readonly autoMode: boolean
  /** The user's original analysis question. */
  readonly question: string
  /** Structured profile (shape, columns, missing, duplicated) when parsing succeeded. */
  readonly schema?: Record<string, unknown>
  /** Canonical pickle written so later stages read cleanly (preserves dtypes). */
  readonly loadedPath?: string
}

/** Payload of the `analysis/chart` session event. */
export interface AnalysisChart {
  /** Stable id for this chart, minted at save time. */
  readonly chartId: string
  /** Human-facing chart title, derived from the ECharts option when absent. */
  readonly title: string
  /** The validated ECharts option object. */
  readonly spec: Record<string, unknown>
}

/** Payload of the `analysis/report` session event. */
export interface AnalysisReport {
  /** Stable id for this report, minted at save time. */
  readonly reportId: string
  /** The Markdown report body. */
  readonly markdown: string
}

/** One chart summary folded into the `analysisState` projection. */
export interface AnalysisChartSummary {
  readonly chartId: string
  readonly title: string
}

/** Whole-value projection state folded from the `analysis/*` events. */
export interface AnalysisState {
  /** Last loaded workspace path, or `null` before `load_table` runs. */
  readonly loadedPath: string | null
  /** Whether the session is in auto mode. */
  readonly autoMode: boolean
  /** The fixed route, or `null` before `set_route`. */
  readonly route: AnalysisRoute | null
  /** Saved charts in save order. */
  readonly charts: AnalysisChartSummary[]
  /** Last saved report id, or `null` before `save_report`. */
  readonly reportId: string | null
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The agent registered one input table and its resolved auto-mode.
     * @param data - path, format, auto mode, and the original question.
     */
    'analysis/loaded': AnalysisLoaded
    /**
     * The agent fixed the session's analysis route.
     * @param data - the fixed route.
     */
    'analysis/route': { readonly route: AnalysisRoute }
    /**
     * The agent saved one validated chart.
     * @param data - chart identity and ECharts spec.
     */
    'analysis/chart': AnalysisChart
    /**
     * The agent saved one report body.
     * @param data - report identity and Markdown body.
     */
    'analysis/report': AnalysisReport
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** The wizard state for the data-analysis agent. */
    analysisState: AnalysisState
  }
}
