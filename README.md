# dsh data-analysis plugin

一个可独立安装的 DeepSeek Harness（dsh）数据分析智能体：把表格数据交给模型，
由它分阶段完成清洗、探索、可视化或机器学习建模，并产出图表与报告。它通过 dsh
的 profile bundle 机制分发，不改 dsh 源码。

## 包

所有包统一使用 `@andy1797833970` scope。仓库当前为**私有**：
`https://github.com/andy1797833970/dsh-data-analysis-plugin`。

| 包 | 职责 |
|---|---|
| `@andy1797833970/dsh-code-runtime-python` | Python Code Runtime 后端：每段 `run_code` 在独立 Python 进程执行，经 NDJSON 桥接 host 工具 |
| `@andy1797833970/dsh-data-analysis` | 模型工具 `load_table` / `set_route` / `save_chart` / `save_report` / `export_pdf` 与 `analysisState` 投影 |
| `@andy1797833970/dsh-skill-data-analysis` | 运行时技能族：总编排 + 清洗 / EDA / 可视化 / 建模 / 报告 |
| `@andy1797833970/dsh-bundle-data-analysis` | profile patch：禁用 TS worker、挂载 Python 后端、工具与技能 |

## 安装与运行

见 [examples/README.md](examples/README.md)。

最短路径（包发布后）：

```sh
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

## Python 环境

```sh
scripts/setup-python.ps1   # Windows
./scripts/setup-python.sh   # macOS / Linux
```

脚本创建 `./.venv`、安装 `requirements-data-analysis.txt`，并把 `DSH_PYTHON`
指向该解释器。运行时只读取 `DSH_PYTHON`。

## 数据流

上传/给出文件路径 → `load_table` 自动识别格式与编码并写 `loaded.parquet` →
`run_code` 清洗后写 `clean.parquet` → `ask_user_question` 闸门 → `set_route`
（viz/ml）→ EDA → 可视化或建模 → 闸门 → `save_report` + `export_pdf`。
“全自动 / 自动分析 / 自动跑 / auto”关键词会跳过所有闸门直达报告。

## 开发与构建

本仓库的 `@deepseek-ai/dsh-*` 与 `@deepseek-ai/cordis` / `schemastery` 以
`^0.1.0-rc.5` 作为 peer/dev 依赖；在这些包发布到 npm 之前，`pnpm install`
无法独立完成，需要配合 `deepseek-harness` 源码 checkout 使用。

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## v1 已知限制

- 不包含自定义 ECharts 图表节点：v1 用通用工具卡片 + Markdown 报告展示，图表
  卡需要重建 dsh web 前端，留作后续。
- 依赖 `@deepseek-ai/dsh-*` 与 vendored 依赖；在 dsh 发布这些包之前，只能以
  “源码 checkout + profile”方式使用。

## 决策记录

见 [docs/architecture.md](docs/architecture.md)。

## License

[MIT](LICENSE)
