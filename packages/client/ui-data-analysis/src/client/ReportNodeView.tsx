import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Complete keyed report renderer props. */
export type ReportNodeViewProps =
  PropsRuntime<'conversation.chat.node', 'data-analysis-report'>
  & PropsLocale<'dataAnalysis'>

/** Render one saved Markdown report. */
export function ReportNodeView({ node, t }: ReportNodeViewProps) {
  return (
    <section>
      <h3>{t('report.title')}</h3>
      <MarkdownText text={node.data.markdown} />
    </section>
  )
}
