# @deepseek-ai/dsh-client-ui-data-analysis

Browser-side data-analysis wizard UI: ECharts and Markdown conversation nodes
for saved charts and reports.

## What it does

Registers two conversation-node definitions (`data-analysis-chart`,
`data-analysis-report`) and their keyed `conversation.chat.node` renderers. The
chart renderer mounts an ECharts instance from the saved option; the report
renderer uses the shared Markdown primitive.

## Known Limitations and Deferred Work

- **No wizard step bar** — the `analysisState` projection-driven stage strip is not yet rendered.
- **ECharts only** — charts render through `echarts`; there is no image or static fallback.
- **Chart snapshots deferred** — report PDF export does not embed chart snapshots.
