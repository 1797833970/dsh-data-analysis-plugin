# 架构

## Python 后端替换 TypeScript worker

dsh 的 `run_code` 只有一个 `ctx.codeRuntime` 实现。本插件通过 bundle patch 禁用
内置 TS worker，并插入 `@andy1797833970/dsh-code-runtime-python`。它每次 `run()` 启动一个
独立 Python 进程：程序写 pandas/sklearn，工具调用经 stdio NDJSON 桥接回 host，
由 AST 守卫 + 文件沙箱 + 超时 + 输出上限约束。进程结束即丢状态，所以阶段之间的
中间 DataFrame 写成 `parquet` 文件再读回。

选择进程隔离而不是常驻 kernel，是因为 `ctx.codeRuntime` 是无状态契约；中间文件
也正好让模型可见状态全部落在文件系统与 session 事件上。

## 技能引导 + 闸门，而不是固定状态机

流程不写死成 LangGraph 那样的状态机。`skill-data-analysis` 用技能文本规定阶段
顺序与规则；`ask_user_question` 做用户闸门；`set_route` 在会话内固定 viz/ml；
模型自主决定每阶段的具体 pandas 代码。阶段、路线、图表、报告通过 `analysis/*`
session 事件落盘，`analysisState` 投影供 UI 读取。

这样模型拥有“怎么做”的自由度，而“哪些事实必须落盘、哪些边界必须确定”仍由工具
保证。

## 独立 bundle 分发

本插件不是 dsh 的 patch，而是一个声明 `dsh.bundle.patch` 的 npm 包。用户的
profile 目录按序组合 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、
`@andy1797833970/dsh-bundle-data-analysis`，最后应用用户自己的 `cordis.patch.yml`。包内不
写 `process.cwd()` 相对路径，读取器逻辑内联，保证 npm 安装后仍可解析。
