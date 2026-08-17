import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Complete keyed chart renderer props. */
export type ChartNodeViewProps =
  PropsRuntime<'conversation.chat.node', 'data-analysis-chart'>
  & PropsLocale<'dataAnalysis'>

/** Render one saved ECharts option and dispose the instance on unmount. */
export function ChartNodeView({ node }: ChartNodeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const element = containerRef.current
    if (element === null) return
    const chart = echarts.init(element)
    chart.setOption(node.data.spec as echarts.EChartsOption)
    const onResize = (): void => { chart.resize() }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [node.data.spec])
  return <div ref={containerRef} style={{ width: '100%', height: 320 }} role="img" aria-label={node.data.title} />
}
