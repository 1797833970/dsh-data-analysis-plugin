# 数据分析插件：使用与概念（小白版）

本文给第一次接触这个插件的读者解释它由哪些零件组成、一次分析怎么跑完，以及想改行为时看哪里。它不是开发日志，也不展开实现细节。

## 装好后能做什么

用户把表格文件路径和一个问题交给智能体，智能体自己完成：读取并清洗数据 → 探索分析 → 选择可视化或机器学习路线 → 生成图表和报告 → 导出 PDF 或 HTML。

## 5 个零件

| 包 | 职责 | 类比 |
| --- | --- | --- |
| `code-runtime-python` | 让模型在隔离的 Python 进程里写 pandas/sklearn | 安全考场 |
| `data-analysis` | 提供 5 个工具、`analysis/*` 事件和 `analysisState` 投影 | 按钮 + 账本 + 仪表盘 |
| `skill-data-analysis` | 提供清洗、EDA、可视化、建模、报告的操作说明 | 新员工 SOP |
| `bundle-data-analysis` | 用 profile patch 把上面三件按顺序装起来 | 装机清单 |
| `client-ui-data-analysis` | 在网页里渲染 ECharts 图表和 Markdown 报告 | 成品展示 |

前 4 个是 v1 构建工作区里的活动包；`client-ui-data-analysis` 位于 `deferred/`，当前不构建。v1 用通用工具卡片和 Markdown 输出展示图表与报告。

## 一次分析按什么顺序走

1. 模型调用 `load_table(path, question)`，把输入文件登记为分析目标并写 `loaded.parquet`。
2. 模型在 `run_code` 里读数据、看形状和缺失值。
3. 模型在 `run_code` 里清洗数据，把中间结果写 `clean.parquet`。
4. 模型调用 `ask_user_question`，让用户决定继续或重新分析。
5. 模型调用 `set_route(route)`，固定 `viz` 或 `ml`。
6. 模型做 EDA，然后可视化或建模。
7. 模型调用 `save_chart` 保存图表，调用 `save_report` 保存报告。
8. 模型调用 `export_pdf`，产出 PDF；Python 渲染器不可用时返回 HTML。

问题中出现“全自动”“自动分析”“自动跑”或“auto”时，第 4 步的闸门会跳过。

## 模型能看到什么

### 工具

| 工具 | 作用 |
| --- | --- |
| `load_table(path, question)` | 登记文件，返回格式和是否全自动 |
| `set_route(route)` | 固定 `viz` 或 `ml` |
| `save_chart(spec)` | 保存一张 ECharts 图表 |
| `save_report(markdown)` | 保存最终 Markdown 报告 |
| `export_pdf(reportId)` | 渲染报告为 PDF，或返回 HTML |

### 事件与投影

每个工具写入一个 `analysis/*` 会话事件：`analysis/loaded`、`analysis/route`、`analysis/chart`、`analysis/report`。`analysisState` 投影把这些事件折叠成当前进度。

## 名词表

- `ctx`：Cordis 上下文，插件之间通过它发现和调用服务。
- `effect`：注册一个贡献，插件卸载时一并撤销。
- `Code Mode / run_code`：模型写整段代码一次运行，而不是逐步调用工具。
- `session event`：会话日志中的一条可回放记录。
- `projection`：把事件流折叠成当前状态。
- `bundle`：profile patch 层，声明启动时挂载哪些插件。

## 想改行为时看哪里

| 想改什么 | 入口 |
| --- | --- |
| 分析流程、提示词、配方 | `packages/data-analysis/skill-data-analysis/src/index.ts` |
| 新增或修改工具 | `packages/data-analysis/data-analysis/src/index.ts` |
| Python 可用模块与安全规则 | `packages/code-runtime/code-runtime-python/src/index.ts` |
| 启动时装哪些零件 | `packages/data-analysis/bundle-data-analysis/cordis.patch.yml` |
| 图表和报告在网页里的样子 | `deferred/ui-data-analysis/src/client/` |
