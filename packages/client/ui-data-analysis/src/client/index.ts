/**
 * Data-analysis wizard UI, browser half: durable chart and report conversation
 * nodes with ECharts and Markdown renderers.
 * @module @andy1797833970/dsh-client-ui-data-analysis/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@andy1797833970/dsh-data-analysis/types'
import { ChartNodeView } from './ChartNodeView.tsx'
import { ReportNodeView } from './ReportNodeView.tsx'
import { en, NS, zh, type DataAnalysisKey } from './locales.ts'
import { chartDefinition, reportDefinition } from './definitions.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Data-analysis node copy. */
    dataAnalysis: DataAnalysisKey
  }
}

/** Required services for Definitions, keyed renderers, and copy. */
export const inject = ['conversationEvents', 'slots', 'locale']

/**
 * Register the two node definitions, the dictionary, and the keyed renderers.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.conversationEvents.register(chartDefinition)
  ctx.conversationEvents.register(reportDefinition)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-data-analysis: dictionaries')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'data-analysis-chart',
    locale: NS,
    inject: () => ({}),
  }, ChartNodeView))
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'data-analysis-report',
    locale: NS,
    inject: () => ({}),
  }, ReportNodeView))
}
