import { describe, expect, it } from 'vitest'
import type { AnalysisState, AnalysisLoaded, AnalysisChart, AnalysisReport } from '../src/types.ts'

/** Recreate the projection apply logic for direct unit testing. */
function applyProjection(state: AnalysisState, event: { type: string; data: unknown }): AnalysisState {
  switch (event.type) {
    case 'analysis/loaded': {
      const data = event.data as AnalysisLoaded
      return { ...state, loadedPath: data.path, autoMode: data.autoMode }
    }
    case 'analysis/route':
      return { ...state, route: (event.data as { route: 'viz' | 'ml' }).route }
    case 'analysis/chart': {
      const data = event.data as AnalysisChart
      return { ...state, charts: [...state.charts, { chartId: data.chartId, title: data.title }] }
    }
    case 'analysis/report': {
      const data = event.data as AnalysisReport
      return { ...state, reportId: data.reportId }
    }
    default:
      return state
  }
}

const initialState: AnalysisState = {
  loadedPath: null,
  autoMode: false,
  route: null,
  charts: [],
  reportId: null,
}

describe('analysisState projection', () => {
  it('has correct initial state', () => {
    expect(initialState).toEqual({
      loadedPath: null,
      autoMode: false,
      route: null,
      charts: [],
      reportId: null,
    })
  })

  it('analysis/loaded updates loadedPath and autoMode', () => {
    const event = {
      type: 'analysis/loaded' as const,
      data: { path: '/tmp/data.csv', format: 'csv', autoMode: true, question: 'test' },
    }
    const state = applyProjection(initialState, event)
    expect(state.loadedPath).toBe('/tmp/data.csv')
    expect(state.autoMode).toBe(true)
    expect(state.route).toBeNull()
    expect(state.charts).toEqual([])
    expect(state.reportId).toBeNull()
  })

  it('analysis/route updates route to viz', () => {
    const state = applyProjection(initialState, {
      type: 'analysis/route' as const,
      data: { route: 'viz' as const },
    })
    expect(state.route).toBe('viz')
  })

  it('analysis/route updates route to ml', () => {
    const state = applyProjection(initialState, {
      type: 'analysis/route' as const,
      data: { route: 'ml' as const },
    })
    expect(state.route).toBe('ml')
  })

  it('analysis/chart appends one chart', () => {
    const state = applyProjection(initialState, {
      type: 'analysis/chart' as const,
      data: { chartId: 'chart-1', title: 'Sales', spec: { series: [] } },
    })
    expect(state.charts).toHaveLength(1)
    expect(state.charts[0]).toEqual({ chartId: 'chart-1', title: 'Sales' })
  })

  it('analysis/chart appends multiple charts in order', () => {
    let state = initialState
    state = applyProjection(state, {
      type: 'analysis/chart' as const,
      data: { chartId: 'chart-1', title: 'First', spec: { series: [] } },
    })
    state = applyProjection(state, {
      type: 'analysis/chart' as const,
      data: { chartId: 'chart-2', title: 'Second', spec: { series: [] } },
    })
    state = applyProjection(state, {
      type: 'analysis/chart' as const,
      data: { chartId: 'chart-3', title: 'Third', spec: { series: [] } },
    })
    expect(state.charts).toHaveLength(3)
    expect(state.charts[0]!.chartId).toBe('chart-1')
    expect(state.charts[1]!.chartId).toBe('chart-2')
    expect(state.charts[2]!.chartId).toBe('chart-3')
    const titles = state.charts.map(c => c.title)
    expect(titles).toEqual(['First', 'Second', 'Third'])
  })

  it('analysis/report updates reportId', () => {
    const state = applyProjection(initialState, {
      type: 'analysis/report' as const,
      data: { reportId: 'report-abc', markdown: '# Test' },
    })
    expect(state.reportId).toBe('report-abc')
  })

  it('unknown events do not change state', () => {
    const state = applyProjection(initialState, {
      type: 'some/other/event' as const,
      data: { foo: 'bar' },
    })
    expect(state).toEqual(initialState)
  })

  it('full sequence produces correct final state', () => {
    let state = initialState
    state = applyProjection(state, {
      type: 'analysis/loaded' as const,
      data: { path: '/tmp/data.csv', format: 'csv', autoMode: true, question: 'auto analyze' },
    })
    state = applyProjection(state, {
      type: 'analysis/route' as const,
      data: { route: 'viz' as const },
    })
    state = applyProjection(state, {
      type: 'analysis/chart' as const,
      data: { chartId: 'c1', title: 'Chart 1', spec: { series: [] } },
    })
    state = applyProjection(state, {
      type: 'analysis/chart' as const,
      data: { chartId: 'c2', title: 'Chart 2', spec: { series: [] } },
    })
    state = applyProjection(state, {
      type: 'analysis/report' as const,
      data: { reportId: 'r1', markdown: '# Report' },
    })
    expect(state).toEqual({
      loadedPath: '/tmp/data.csv',
      autoMode: true,
      route: 'viz',
      charts: [
        { chartId: 'c1', title: 'Chart 1' },
        { chartId: 'c2', title: 'Chart 2' },
      ],
      reportId: 'r1',
    })
  })
})
