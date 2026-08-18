# 数据分析插件：AI 自动安装手册

本文件给 coding agent 使用。你的任务是把 `data-analysis-plugin` 安装到用户的
DeepSeek Harness 中并验证配置可用。不要改写插件源码，不要替用户选择模型、API key
或分析问题。所有路径都用绝对路径。

## 输入变量

- `PLUGIN_ROOT`：本仓库根目录。
- `DSH_ROOT`：DeepSeek Harness 源码 checkout 或安装目录；如果 `dsh` 已在 PATH 中，可省略。
- `DSH_HOME`：未设置时默认为用户主目录下的 `.dsh`。
- `PROFILE`：默认 `data-analysis`。

## 先检查

按顺序检查，任何一项失败就停止并报告缺什么：

1. `node --version` 在 dsh 支持的 Node 范围内。
2. `pnpm --version` 可用。
3. `python --version` 或 `python3 --version` 为 3.11+。
4. 目标 npm registry 可访问（如果走发布包安装）。
5. `dsh` 或 `$DSH_ROOT` 中的 `pnpm dsh` 可执行。

## 选择安装路径

如果 npm registry 已有 `@andy1797833970/dsh-bundle-data-analysis`，走
“发布包安装”。否则走“本地源码安装”。

### 发布包安装

在 `$DSH_ROOT` 下执行；如果 `dsh` 不在 PATH，用 `pnpm dsh` 替代 `dsh`。

```sh
dsh plugin --profile data-analysis add @deepseek-ai/dsh-web-app@0.1.0-rc.6
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis@0.1.0
dsh plugin --profile data-analysis install
```

两条 `add` 不能合并成一条。顺序决定 `dsh.profile.bundles` 中 `web-app` 和
`bundle` 的先后；顺序错误会导致 `code-runtime` 未被禁用。执行后重启 dsh 才会
加载插件。

### 本地源码安装（Windows）

```powershell
cd "$PLUGIN_ROOT"
pnpm install
pnpm build
powershell -ExecutionPolicy Bypass -File "$PLUGIN_ROOT\scripts\reinstall-local.ps1" -PluginRoot "$PLUGIN_ROOT" -Profile data-analysis
```

脚本会打包 4 个包、重建 `$DSH_HOME/profiles/data-analysis`、用
`pnpm.overrides` 把内部依赖重定向到本地 tarball，并执行 `pnpm install`。

### 本地源码安装（macOS / Linux）

当前仓库没有与 `reinstall-local.ps1` 等价的 shell 脚本。优先走发布包安装；
如果 npm 包尚未发布且用户必须在 macOS/Linux 本地安装，报告这个限制，并让用户
选择是否等待发布或提供 Windows 环境。

## 配置 Python 环境

`setup-python.ps1` 在 Windows 上会交互询问是否设置用户环境变量，不适合 AI
静默执行。用下面的非交互命令替代，并设置当前会话的 `DSH_PYTHON`。

Windows PowerShell：

```powershell
cd "$PLUGIN_ROOT"
python -m venv .venv
$python = (Resolve-Path ".\.venv\Scripts\python.exe").Path
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements-data-analysis.txt
$env:DSH_PYTHON = $python
[Environment]::SetEnvironmentVariable('DSH_PYTHON', $python, 'User')
```

macOS / Linux：

```sh
cd "$PLUGIN_ROOT"
python3 -m venv .venv
"$PLUGIN_ROOT/.venv/bin/python" -m pip install --upgrade pip
"$PLUGIN_ROOT/.venv/bin/python" -m pip install -r requirements-data-analysis.txt
export DSH_PYTHON="$PLUGIN_ROOT/.venv/bin/python"
```

后续启动 dsh 时使用同一个 shell 会话，或确认用户环境中的 `DSH_PYTHON` 已生效。

## 验证配置

在启动服务的 shell 中执行：

```sh
dsh --profile data-analysis --dump-config
```

如果 `dsh` 不在 PATH：

```sh
cd "$DSH_ROOT"
pnpm dsh --profile data-analysis --dump-config
```

确认：

- `code-runtime` 为 `disabled: true`。
- `code-runtime-python` 已挂载。
- `data-analysis` 已挂载。
- `skill-data-analysis` 已挂载。
- profile 的 `dsh.profile.bundles` 顺序为
  `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、
  `@andy1797833970/dsh-bundle-data-analysis`。

## 启动与最小验证

```sh
dsh --profile data-analysis
```

打开 `http://127.0.0.1:3080`。AI 无法替用户完成 GUI 点击时，至少确认服务
成功启动、profile 配置正确，并告诉用户下一步：

> 上传一个 CSV 或给一个完整绝对路径，然后问“帮我全自动分析这份数据”。

预期会话工作目录出现 `loaded.parquet`、`clean.parquet`，页面出现图表和报告。
如果 `load_table` 报找不到文件，让用户提供完整绝对路径。

## 常见失败处理

- `pnpm install` 被 build-script 策略拦截：确认 `pnpm-workspace.yaml` 的
  `allowBuilds` 已包含 `node-pty`、`koffi`、
  `@deepseek-ai/dsh-subprocess-local`，然后重试。
- `dsh plugin` 命令不存在：改用 `cd "$DSH_ROOT"` 后执行
  `pnpm dsh plugin ...`。
- `DSH_PYTHON` 指向错误解释器：用上面非交互命令重建 `.venv`，并在同一个 shell
  里重新设置 `$env:DSH_PYTHON` / `export DSH_PYTHON`。
