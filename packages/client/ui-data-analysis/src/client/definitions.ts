import type { ChatConversationViewNode, ConversationLocation, ConversationNodeContext, ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'

/** Final renderer data for one saved chart. */
export interface ChartChatData {
  readonly chartId: string
  readonly title: string
  readonly spec: Record<string, unknown>
}

/** Final renderer data for one saved report. */
export interface ReportChatData {
  readonly reportId: string
  readonly markdown: string
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    'data-analysis-chart': ChartChatData
    'data-analysis-report': ReportChatData
  }
}

/** Resolve the durable location for a node, falling back to unresolved. */
function locationOf(context: ConversationNodeContext): ConversationLocation {
  return context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' }
}

/** Durable chart event folded into one keyed Chat node. */
export const chartDefinition: ConversationNodeDefinition<ChartChatData> = {
  kind: 'data-analysis-chart',
  target: 'chat',
  match: event => event.type === 'analysis/chart' ? { id: event.data.chartId, role: 'start' } : null,
  start: (_context, match) => {
    if (match.event.type !== 'analysis/chart') throw new Error('data-analysis-chart requires analysis/chart')
    return {
      chartId: match.event.data.chartId,
      title: match.event.data.title,
      spec: match.event.data.spec,
    }
  },
  update: context => context.state,
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'data-analysis-chart',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: locationOf(context),
      visibility: 'visible',
      data: context.state,
    }
  },
}

/** Durable report event folded into one keyed Chat node. */
export const reportDefinition: ConversationNodeDefinition<ReportChatData> = {
  kind: 'data-analysis-report',
  target: 'chat',
  match: event => event.type === 'analysis/report' ? { id: event.data.reportId, role: 'start' } : null,
  start: (_context, match) => {
    if (match.event.type !== 'analysis/report') throw new Error('data-analysis-report requires analysis/report')
    return { reportId: match.event.data.reportId, markdown: match.event.data.markdown }
  },
  update: context => context.state,
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'data-analysis-report',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: locationOf(context),
      visibility: 'visible',
      data: context.state,
    }
  },
}
