# @deepseek-ai/dsh-client-ui-data-analysis

Browser-side data-analysis wizard UI: ECharts and Markdown conversation nodes
for saved charts and reports. This package lives under `deferred/` and is not
built or published in v1.

## What it does

Registers two conversation-node definitions (`data-analysis-chart`,
`data-analysis-report`) and their keyed `conversation.chat.node` renderers. The
chart renderer mounts an ECharts instance from the saved option; the report
renderer uses the shared Markdown primitive.

## Known Limitations

- **No wizard step bar** — the `analysisState` projection does not render a stage strip.
- **ECharts only** — charts render through `echarts`; there is no image or static fallback.
- **No chart snapshots** — report PDF export does not embed chart snapshots.
