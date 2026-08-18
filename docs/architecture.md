# 架构

## 组合

`@andy1797833970/dsh-bundle-data-analysis` 提供一个 profile patch。它禁用内置 `code-runtime`，启用 `tool-skill`，写入 data-analysis persona，并按顺序插入 `code-runtime-python`、`data-analysis`、`skill-data-analysis` 和 `tool-ask-user`。

## Python 执行

`code-runtime-python` 在 `ctx.codeRuntime` 上注册 `language: 'python'`、`isolation: 'process'`。每次 `run()` 启动一个 Python 子进程，经 stdio 的 NDJSON 协议桥接 `await tools.*` 调用；AST 守卫、文件沙箱、超时和输出上限限制单次运行。进程结束即丢状态，中间 DataFrame 以 parquet 文件持久化。

## 模型流程与状态

`data-analysis` 注册 5 个工具。每个工具写入一个 `analysis/*` 会话事件；`analysisState` 投影把事件折叠为 `{ loadedPath, autoMode, route, charts, reportId }`。`skill-data-analysis` 提供阶段顺序和配方；`ask_user_question` 做阶段闸门。模型在 Code Mode 里决定每个阶段的 pandas/sklearn 代码。

## 分发与路径

bundle patch 不含 `process.cwd()` 相对路径，读取器逻辑内联。profile 按 `dsh-base`、`dsh-web-app`、`bundle-data-analysis` 顺序组合，最后应用用户的 `cordis.patch.yml`。
