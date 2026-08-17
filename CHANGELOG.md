# Changelog

## 0.1.0

- Initial standalone release of the DeepSeek Harness data-analysis agent.
- Python `code-runtime` backend with process isolation, an import/AST guard,
  tool bridging over NDJSON, timeout, and output caps.
- `load_table` with automatic encoding, delimiter, and format detection writing
  a canonical `loaded.parquet`; `set_route`, `save_chart`, `save_report`, and
  `export_pdf` tools; `analysisState` projection.
- Runtime skill family: data-analysis orchestration plus cleaning, EDA,
  visualization, modeling, and reporting recipes.
- `dsh.profile` bundle for `dsh --profile data-analysis`.
