# 开发与修改说明

这个插件是独立仓库，不修改 DeepSeek Harness 源码。它通过三个东西接入 dsh：

- 一个 profile：`data-analysis`
- 一个 bundle patch：`packages/data-analysis/bundle-data-analysis/cordis.patch.yml`
- 一个 agent preset：`data-analysis`

## 仓库结构

- `packages/code-runtime/code-runtime-python`：Python 代码运行器。
- `packages/data-analysis/data-analysis`：读取、保存、导出等工具。
- `packages/data-analysis/skill-data-analysis`：清洗、探索、可视化、建模、报告的操作说明。
- `packages/data-analysis/bundle-data-analysis`：把上面这些部分组合起来。
- `packages/client/ui-data-analysis`：网页端图表和报告渲染器。
- `presets/agent-preset-data-analysis`：`data-analysis` agent preset 的源文件。

## 想改什么去哪里

| 想改什么 | 入口 |
| --- | --- |
| 分析流程、提示词、报告格式 | `packages/data-analysis/skill-data-analysis/src/index.ts` |
| 读取文件、保存图表、保存报告、导出 PDF | `packages/data-analysis/data-analysis/src/index.ts` |
| Python 允许导入的库、运行时间、输出上限 | `packages/code-runtime/code-runtime-python/src/index.ts` |
| 启动时挂载哪些插件 | `packages/data-analysis/bundle-data-analysis/cordis.patch.yml` |
| 图表和报告在网页里的样子 | `packages/client/ui-data-analysis/src/client/` |

## 为什么不需要改 dsh 源码

插件通过 `dsh.profile.bundle` 机制挂载。bundle patch 会：

- 禁用 dsh 自带的 TypeScript 代码运行器。
- 挂载 Python 代码运行器。
- 挂载数据分析工具、操作说明和用户确认按钮。
- 挂载网页端的图表和报告展示模块。

用户只需要安装 `data-analysis` agent preset 和 profile，不需要修改 dsh 仓库里的任何文件。

## 如何构建和本地测试

```powershell
pnpm install
pnpm build
scripts\reinstall-local.ps1 -DshRoot <dsh 源码目录> -PluginRoot <插件目录>
cd <dsh 源码目录>
pnpm dsh --profile data-analysis
```

## 如何完整卸载插件设置

卸载脚本只删除插件自己的设置，不会删除会话历史。

Windows：

```powershell
scripts\uninstall.ps1
```

macOS / Linux：

```sh
sh scripts/uninstall.sh
```

删除内容：

- `<DSH_HOME>/profiles/data-analysis`
- `<DSH_HOME>/.agent-presets/data-analysis`

如果还想删除插件目录下的 Python 环境：

Windows：

```powershell
scripts\uninstall.ps1 -RemoveVenv
```

macOS / Linux：

```sh
sh scripts/uninstall.sh --remove-venv
```
