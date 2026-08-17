# Deferred v1 enhancements (not part of the built workspace)

These sources are kept so the work is not lost, but they are intentionally
outside the `packages/*/*` workspace glob and are not built, tested, or
published in v1.

- `ui-data-analysis/` — the native web Chat node renderers for saved charts and
  reports (ECharts card + Markdown report card). v1 shows charts and reports
  through the generic tool card and Markdown output instead; this package needs
  a rebuilt dsh web frontend to be re-enabled.
- `agent-preset-data-analysis/` — the `data-analysis` agent preset
  (`agent.cordis.yml` + `preset.yml`) from the in-repo prototype. The v1 bundle
  patch carries the equivalent persona/tool wiring in `cordis.patch.yml`.
