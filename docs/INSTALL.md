# 安装、卸载与重装

## 前置条件

- 一个可运行的 DeepSeek Harness。当前 dsh 尚未发布时，使用
  [`deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 源码
  checkout（`pnpm install && pnpm build`，或直接用源码启动）。
- Python 3.11+。
- pnpm。

## 获取插件

```sh
git clone https://github.com/1797833970/dsh-data-analysis-plugin.git
```

## 方式 A：发布包安装

```sh
dsh plugin --profile data-analysis add @deepseek-ai/dsh-web-app@0.1.0-rc.6
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis@0.1.0
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

两条 `add` 必须分开执行，顺序决定 `dsh.profile.bundles` 中 `web-app` 和
`bundle` 的先后；顺序错误会导致 `code-runtime` 未被禁用。`dsh plugin` 修改该
profile 的 manifest，重启 dsh 后插件才会加载。

## 方式 B：本地源码安装（Windows）

```powershell
cd <plugin-root>
pnpm install
pnpm build
scripts\reinstall-local.ps1
```

脚本会打包 4 个 `@andy1797833970/*` 包、重建 `$DSH_HOME/profiles/data-analysis`、
用 `pnpm.overrides` 把内部依赖重定向到本地 tarball，并执行 `pnpm install`。
启动命令：

```sh
pnpm dsh --profile data-analysis
```

macOS 和 Linux 的本地自动重装脚本尚未提供；在这些平台上优先使用发布包安装。

## Python 环境

Windows：

```powershell
scripts\setup-python.ps1
```

macOS / Linux：

```sh
./scripts/setup-python.sh
```

脚本创建 `.venv`、安装 `requirements-data-analysis.txt`，并提示设置
`DSH_PYTHON`。运行时只读取 `DSH_PYTHON`。

## 验证

安装后执行：

```sh
dsh --profile data-analysis --dump-config
```

确认 `code-runtime` 为 `disabled: true`，且 `code-runtime-python`、
`data-analysis`、`skill-data-analysis` 已挂载。然后启动：

```sh
dsh --profile data-analysis
```

打开 `http://127.0.0.1:3080`，给一个 CSV 的完整绝对路径做一次分析，确认
`loaded.parquet` 和 `clean.parquet` 出现在会话工作目录，页面能出图和报告。

## 卸载与重装

删除 profile 目录后重新安装：

Windows：

```powershell
Remove-Item -Recurse -Force "$env:DSH_HOME\profiles\data-analysis"
```

macOS / Linux：

```sh
rm -rf "${DSH_HOME:-$HOME/.dsh}/profiles/data-analysis"
```
