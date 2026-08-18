# Deferred 目录

`deferred/` 下的源码不参与 v1 构建、测试和发布。它们保留为后续前端集成的实现参考。

- `ui-data-analysis/` — 图表和报告的自定义 Conversation Node 渲染器。v1 通过通用工具卡片和 Markdown 输出展示；启用该包需要重建 dsh web 前端。
- `agent-preset-data-analysis/` — 独立的 agent preset 文件。v1 的 bundle patch 在 `cordis.patch.yml` 中提供等价的 persona 和工具组合。
