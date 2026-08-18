# @andy1797833970/dsh-data-analysis

Model-facing data-analysis tools plus the `analysisState` projection. The five
tools own the deterministic boundaries; the model drives the analysis itself
in Code Mode.

## What it does

Registers `load_table`, `set_route`, `save_chart`, `save_report`, and
`export_pdf` on `ctx.tools`. Each appends a durable `analysis/*` session event,
and the `analysisState` projection folds those events plus the todo list into
the wizard read model.

## Model Experience

### Tools

#### What the model sees

Five model-facing tool schemas: `load_table(path, question)`, `set_route(route)`, `save_chart(spec)`, `save_report(markdown)`, and `export_pdf(reportId)`.

#### Token effect

Fixed schema cost on every request where the tools are visible.

#### KV Cache effect

Prefix-stable while the definitions and visibility are unchanged.

### Tool-call history and result

#### What the model sees

Results are compact: `load_table` returns `{ path, format, autoMode }`, `set_route` returns `{ route }`, `save_chart` returns `{ chartId, title }`, `save_report` returns `{ reportId }`, and `export_pdf` returns `{ reportId, html, pdfPath? }`.

#### Token effect

Data-dependent retained tokens for arguments and results until compaction.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix.

## Known Limitations

- **HTML-first export** — `export_pdf` produces a PDF only when a configured Python renderer is available; otherwise it returns the HTML companion.
- **Stateless analysis** — stages are stateless Code Mode runs; intermediate data persists as parquet files.
- **No storage domain** — charts and reports live in session events plus the projection, not a cross-session domain.
