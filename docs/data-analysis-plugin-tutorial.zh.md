# 数据分析智能体插件是怎么做出来的（小白版）

这是一份面向初学者的教学文档，讲解基于 DeepSeek Harness（dsh）实现的数据分析智能体插件。文中第一次出现的高深名词都会用大白话解释。

## 先理解一个总前提：dsh 是“乐高式”的智能体框架

**智能体（agent）**：可以把它想成一个“会自己动手的程序”。你给它一个目标，它自己决定调用哪些工具、一步步干完。

**dsh（DeepSeek Harness）**：一个搭智能体的框架。它最核心的一条规矩是——**一切功能都是插件（plugin）**。就像乐高：基础积木是固定的，但每一个新功能都是一块可以插上去、也可以拆下来的积木。

**插件到底在干嘛？** 简单说就是三件事之一：

1. 给系统**注册一个新工具**（让模型能按一个“按钮”）。
2. 给系统**注册一个新服务**（让别的插件能调用它）。
3. 给系统**注册一段提示词/说明书**（让模型知道该怎么做）。

**最关键的一个词：`ctx`（上下文 Context）**。把它理解成一块“公共布告栏”：插件 A 在布告栏上贴一个“我会算数”的纸条，插件 B 想找人算数时就去布告栏上看“有没有人会算数”，有就用，没有就报错。插件之间不直接认识对方，全靠布告栏牵线。

## 这个项目最终是什么样：5 个零件

需求是：**用户上传一个表格，用一句话提问，系统自动完成“清洗数据 → 探索分析 → 画图或训练模型 → 生成报告 + PDF”**。

我们没有把它写成一个“一大坨程序”，而是拆成 5 个可以独立替换的乐高积木：

| 包（零件） | 大白话作用 | 生活类比 |
|---|---|---|
| `code-runtime-python` | 让模型**真的能跑 Python 代码** | 一个安全监考考场 |
| `data-analysis` | 给模型配 **5 个专用按钮** + 一本流水账 + 一个仪表盘 | 按钮 + 账本 + 仪表盘 |
| `skill-data-analysis` | 给模型一本**操作说明书** | 新员工 SOP 手册 |
| `client-ui-data-analysis` | 把结果**画到网页上** | 账本 → 成品展示 |
| `bundle-data-analysis` | **一键把上面几件装起来** | 装机清单 |

## 零件 1：`code-runtime-python` —— 让模型能跑 Python

### 背景：dsh 本来只会让模型跑一种叫 TypeScript 的代码

dsh 里模型写代码是走一个叫 **`run_code`（Code Mode，代码模式）** 的东西：模型不一句句调用工具，而是直接写一段程序，系统一次跑完、把结果给它。

但 dsh 默认只会跑 **TypeScript**（可以理解为 JavaScript 的一个“更严格版本”），不会跑 **Python**。而数据分析必须用 Python，因为 pandas（处理表格）、numpy（算数）、sklearn（机器学习）这些库只有 Python 有。

> **库（library）** 就是别人写好的现成工具包，`import` 一下就能用，不用自己从头写。

### 我们做了什么

我们写了一个“**跑腿的**”（技术上叫 **Provider，提供者**）。模型每次提交一段 Python 代码，这个跑腿的就做这几件事：

1. 把代码扔进一个**子进程（subprocess）**里跑。子进程 = 一个独立的“小房间”，跑挂了也不会把主程序带崩。
2. 用一个**沙箱（sandbox）**限制它只能读写工作区里的文件，不能乱改系统。沙箱 = 给程序戴上的“权限手铐”。
3. 做一个 **AST 守卫**：先像老师检查作业一样扫描一遍代码，发现 `import os`、`import socket` 这种危险动作就直接拒绝。AST = 把代码解析成“语法树”，方便逐句检查。
4. 设一个**超时**（跑太久就强制叫停）和一个**输出上限**（打印太多就截断）。
5. 模型代码里如果调用别的工具（比如 `await tools.save_chart(...)`），跑腿的会在两个进程之间来回传话（技术上叫 **NDJSON 桥**，就是每行一个 JSON 消息，双方一问一答）。

### 一句话总结

`code-runtime-python` = 一个“**安全考场**”：模型交 Python 卷子，在隔离教室限时作答，危险动作被监考拦住，答完监考把结果收回来。

代码见 [`packages/code-runtime/code-runtime-python/src/index.ts`](../packages/code-runtime/code-runtime-python/src/index.ts)。

## 零件 2：`data-analysis` —— 5 个按钮 + 流水账 + 仪表盘

### 5 个按钮（工具 tool）

模型不能凭空“上传文件”“保存图表”，这些必须有人提前给它做成**工具（tool）**。工具 = 一个有固定输入输出的“按钮”，模型可以调用它。

我们做了 5 个：

- `load_table(path, question)`：登记要分析的文件，顺便判断用户是不是想“全自动跑”。
- `set_route(route)`：定下走哪条路（`viz` = 只画图分析；`ml` = 训练机器学习模型）。
- `save_chart(spec)`：保存一张 ECharts 图表。
- `save_report(markdown)`：保存最终报告。
- `export_pdf(reportId)`：把报告渲染成 PDF（配了 Python 渲染器时）或退化成 HTML。

> **ECharts** 是一个画网页交互式图表的库。图表不是一张图片，而是一份“配置说明”（叫 spec），前端照着这份说明把图“画”出来，所以能缩放、能悬浮看数值。

### 流水账（会话事件 session event）

模型每点一个按钮、每做一步，我们都把它**记到一本“流水账”里**（技术上叫**会话日志 session log**）。比如记下：

- `analysis/loaded`：登记了哪个文件。
- `analysis/route`：选了哪条路。
- `analysis/chart`：保存了哪张图。
- `analysis/report`：保存了哪份报告。

这本账的好处：**可以随时回放**。用户中途刷新网页，前端能根据账本把“已经做到哪一步”重新算出来。

### 仪表盘（投影 projection）

流水账是一堆“零散事件”，但前端想要的是一个“**当前状态**”，比如“现在走到了第 3 步、走的是可视化路线、已经画了 2 张图”。

**投影（projection）** 就是干这个的：把一堆事件**折算**成一个状态对象。我们注册了一个叫 `analysisState` 的投影，它盯着账本，每来一个事件就更新一次当前状态。

### 一句话总结

按钮（工具）= 模型能点的操作；流水账（事件）= 每步都留痕；仪表盘（投影）= 从流水账实时算出的“进度面板”。

代码见 [`packages/data-analysis/data-analysis/src/index.ts`](../packages/data-analysis/data-analysis/src/index.ts)。

## 零件 3：`skill-data-analysis` —— 给模型一本说明书

### 什么是技能（skill）

**技能（skill）** 就是一段写给模型看的 Markdown 说明书。模型拿到它，就知道“这件事的正确流程是什么、有什么坑”。

### 我们写了什么

我们没有写“一本大书”，而是写了一个**技能家族**：一个总指挥 + 五个专职小技能。总指挥 `data-analysis` 负责“先做什么、后做什么”，五个小技能各自只讲一件事：

- `data-cleaning`：数据清洗（去重、填缺失、转类型、处理异常值）。
- `eda`：探索性分析（描述统计、分组聚合、相关性、趋势）。
- `data-visualization`：可视化（用 ECharts 配置画图）。
- `ml-modeling`：机器学习建模（分类/回归）。
- `report-writing`：报告撰写。

每个小技能里都写了**可直接照抄的成熟配方代码**（比如怎么用 pandas 去重、怎么算相关性），并配套一个 Python 工具箱（`toolbox/` 目录下的 `.py` 文件），把同样的函数做成现成的、可以直接 `import` 的积木。这样模型不用每次从头想代码，而是“按配方抄、或用工具箱里的函数”。

总指挥 `data-analysis` 里还写了：

- 总体流程：先 `load_table`，再清洗，再探索（EDA），再选路线，再画图/建模，最后出报告。
- **全自动模式**：如果用户问题里带“全自动/自动分析/auto”，就跳过所有确认、一路跑完。

> **EDA（探索性数据分析）**：就是“先粗略看看数据长什么样、有什么规律”，再做深入分析。

### 一句话总结

技能 = 新员工的 SOP 手册。模型照着它干活，改手册内容就能改变它的行为，不用改代码。

代码见 [`packages/data-analysis/skill-data-analysis/src/index.ts`](../packages/data-analysis/skill-data-analysis/src/index.ts)。

## 零件 4：`client-ui-data-analysis` —— 把结果画到网页上

前面几个零件都在“后台”干活，用户看不见。这个零件负责“前台展示”。

我们注册了两个 **会话节点（Conversation Node）**——可以理解为“网页聊天流里的一种卡片”：

- 看到 `analysis/chart` 事件 → 渲染一张 **ECharts 交互式图表**卡片。
- 看到 `analysis/report` 事件 → 渲染一张 **Markdown 报告**卡片。

> **Markdown** 是一种纯文本排版语法，`#` 表示标题、`-` 表示列表，比 HTML 简单得多。

另外还配了一个 **locale（多语言文案）**：图表卡、报告卡的标题文字，中英文各一套。

### 一句话总结

这个零件 = “账本 → 网页成品展示”。模型存了图表和报告，前端就把它变成用户能看能点的界面。

代码见 [`packages/client/ui-data-analysis/src/client/index.ts`](../packages/client/ui-data-analysis/src/client/index.ts)。

## 零件 5：`bundle-data-analysis` —— 一键组装

### 什么是 bundle（组合包）

你已经有 4 个零件了，但 dsh 启动时怎么知道要装它们？**bundle** 就是一份“**零件清单**”（一个叫 `cordis.patch.yml` 的文件），里面写着“启动时把 code-runtime-python、data-analysis、skill-data-analysis 都装进去”。

### 什么是 preset（预设/身份）

**preset** 决定“这个智能体是谁、能看见哪些工具”。我们给它定了一个**persona（人设）**：“你是数据分析智能体……”，并且只开放数据分析相关的工具。

> **persona** 就是写进系统提示词里的“角色设定”，比如“你是数据分析智能体”。

### 一句话总结

bundle = 装机清单；preset = 用户画像 + 权限范围。两者合起来，dsh 一启动就能变成一个“数据分析智能体”。

组装清单见 [`packages/data-analysis/bundle-data-analysis/cordis.patch.yml`](../packages/data-analysis/bundle-data-analysis/cordis.patch.yml)，人设见 [`apps/cli/config/agent-presets/data-analysis/agent.cordis.yml`](../apps/cli/config/agent-presets/data-analysis/agent.cordis.yml)。

## 完整跑一遍：一个例子

用户上传 `sales.csv`，问：“帮我分析一下销售额”。

1. 模型调用 `load_table("sales.csv", "帮我分析销售额")` → 登记文件，判断不是全自动 → 记 `analysis/loaded`。
2. 模型在 `run_code` 里用 pandas 读数据、看形状和缺失值（这段 Python 在“安全考场”里跑）。
3. 模型写 pandas 清洗数据，把结果存成 `clean.parquet` 文件（因为每次跑都是“**无状态**”的，得靠文件把结果传下去）。
4. 模型调用 `ask_user_question`（系统自带工具）：“继续下一步，还是重新分析？” 用户点继续。
5. 模型调用 `set_route("viz")` → 定下走可视化路线 → 记 `analysis/route`。
6. 模型做 EDA，然后写 pandas 算出几张图的聚合数据，生成 ECharts 配置，逐张 `save_chart` → 记 `analysis/chart`。
7. 模型写 Markdown 报告，`save_report` → 记 `analysis/report`。
8. 模型 `export_pdf` → 产出 PDF/HTML。
9. 前端根据账本和投影，把“步骤进度 + 图表卡片 + 报告卡片”显示出来。

> **无状态（stateless）**：每次 `run_code` 都是“开一个全新房间跑完就关”，不保留上次的变量。所以中间结果要写进文件（`clean.parquet`），下一步再读出来。

## 几个反复出现的高深名词，一句话版

- **ctx / inject / effect**：`ctx` 是公共布告栏；`inject` 是“我需要布告栏上有 X”；`effect` 是“我注册的东西，插件被拆掉时要一起撤走”。
- **能力缝（capability seam）**：一套“接口 + 实现 + 使用者”三件套。拿 Python 执行举例：接口（“能跑代码”）是 dsh 定死的，我们只补了一个“实现”（Python 后端），使用者（`run_code`）不用改。
- **Code Mode / run_code**：模型写整段代码一次跑，而不是一句句调工具。
- **声明合并（declaration merging）**：TypeScript 的一个特性，允许不同文件往同一个“类型表”里追加字段。我们用它在不修改 dsh 核心的情况下，往“会话事件表”里加了 `analysis/*` 这些新事件。
- **zod / schemastery**：两个“校验器”，保证传进来的数据格式正确（比如 route 只能是 `viz` 或 `ml`）。

## 如果我想改它，从哪下手

| 想改什么 | 去哪改 |
|---|---|
| 改分析流程、提示词、清洗配方 | `skill-data-analysis/src/index.ts` 里那段 `SKILL_CONTENT` |
| 加一个新工具（按钮） | `data-analysis/src/index.ts` |
| 改 Python 能用哪些库、安全规则 | `code-runtime-python/src/index.ts` 里的 shim 与配置 |
| 改图表/报告在网页上的样子 | `client-ui-data-analysis/src/client/` |
| 改启动时装哪些零件 | `bundle-data-analysis/cordis.patch.yml` |
