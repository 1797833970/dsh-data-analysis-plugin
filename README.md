# dsh data-analysis plugin

可独立安装的 DeepSeek Harness 数据分析智能体。用户给表格数据和一个问题后，智能体按加载、清洗、探索、可视化或机器学习建模、报告导出的流程完成分析。它通过 `dsh.profile.bundle` 分发，不修改 dsh 源码。

## 工作方式

| dsh 能力 | 本插件用法 |
| --- | --- |
| `ctx.codeRuntime` | 注册 Python 进程后端，替换内置 TypeScript worker；模型在 `run_code` 里写 pandas/sklearn |
| `ctx.tools` | 注册 `load_table`、`set_route`、`save_chart`、`save_report`、`export_pdf` |
| `ctx.skills` | 注册 `data-analysis` 技能族：清洗、EDA、可视化、建模、报告 |
| `ctx.sessionProjections` | 注册 `analysisState`，把 `analysis/*` 事件折叠成当前分析状态 |
| profile bundle | `cordis.patch.yml` 按顺序挂载 Python 后端、工具、技能和用户闸门 |

数据流：`load_table` 写 `loaded.parquet` → `run_code` 清洗后写 `clean.parquet` → `ask_user_question` 闸门 → `set_route` 固定 `viz` 或 `ml` → EDA → 可视化或建模 → `save_report` → `export_pdf`。问题中出现“全自动”“自动分析”“自动跑”或“auto”时跳过所有闸门。

## 包

| 包 | 职责 |
| --- | --- |
| `@andy1797833970/dsh-code-runtime-python` | Python 执行后端：每次 `run_code` 在独立 Python 进程中运行，经 NDJSON 桥接 host 工具 |
| `@andy1797833970/dsh-data-analysis` | 5 个模型工具和 `analysisState` 投影 |
| `@andy1797833970/dsh-skill-data-analysis` | 运行时技能族与 Python 工具箱 |
| `@andy1797833970/dsh-bundle-data-analysis` | profile patch：禁用 TypeScript worker、挂载 Python 后端、工具与技能 |

## 安装

AI 自动安装请读 [docs/INSTALL.for-agents.md](docs/INSTALL.for-agents.md)；人工安装与卸载见 [docs/INSTALL.md](docs/INSTALL.md)。

发布包安装（两条 `add` 必须分开执行，顺序决定 bundle 层顺序）：

```sh
dsh plugin --profile data-analysis add @deepseek-ai/dsh-web-app@0.1.0-rc.6
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis@0.1.0
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

## Python 环境

```sh
scripts/setup-python.ps1   # Windows
./scripts/setup-python.sh   # macOS / Linux
```

脚本创建 `.venv`、安装 `requirements-data-analysis.txt`，并把 `DSH_PYTHON` 指向 venv 解释器。运行时只读取 `DSH_PYTHON`。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/INSTALL.for-agents.md](docs/INSTALL.for-agents.md) | 给 coding agent 的自动安装步骤 |
| [docs/INSTALL.md](docs/INSTALL.md) | 人工安装、卸载与重装 |
| [docs/architecture.md](docs/architecture.md) | 架构和数据流 |
| [docs/data-analysis-plugin-tutorial.zh.md](docs/data-analysis-plugin-tutorial.zh.md) | 小白版使用与概念说明 |
| [examples/README.md](examples/README.md) | 最小运行示例 |

## 已知限制

- 图表先通过通用工具卡片和 Markdown 输出展示；`deferred/ui-data-analysis` 中的自定义 ECharts 节点未启用。
- `export_pdf` 只有在配置的 Python 渲染器可用时返回 PDF，否则返回 HTML。
- Python 运行是进程隔离 + import 守卫，不是容器；网络和系统调用隔离不提供。
- 在 `@deepseek-ai/dsh-*` 发布前，本地源码安装需要 dsh 源码 checkout。

## License

[MIT](LICENSE)
