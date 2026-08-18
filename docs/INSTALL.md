# 安装、卸载与重装

这份文档是给人工操作看的。如果你是要帮别人自动安装的 AI，请看《AI 自动安装说明》。

如果你想修改插件或了解完整卸载方式，请看 [开发与修改说明](DEVELOPMENT.md)。

## 安装前需要准备什么

1. 一个可以运行的 DeepSeek Harness。
2. **Python 3.11 或更高版本**（需要能在命令行执行 `python --version` 或 `python3 --version`）。
3. **pnpm 11.7.0 或更高版本**（需要能在命令行执行 `pnpm --version`）。
   - 安装方式：`npm install -g pnpm` 或参照 [pnpm 官方安装文档](https://pnpm.io/installation)。
4. Node.js 版本需满足 pnpm 要求（推荐 Node.js 22 LTS 或更高）。

如果 DeepSeek Harness 还没有正式发布，你需要先拿到它的源码，并完成一次基础安装。

## 获取插件源码

```sh
git clone https://github.com/1797833970/dsh-data-analysis-plugin.git
```

## 推荐方式：从本地源码安装

这种方式主要适用于 Windows，也是当前最可控的方式。

先进入插件目录，安装依赖并构建：

```powershell
cd <插件目录>
pnpm install
pnpm build
```

然后运行本地重装脚本。下面两个路径都要替换成真实目录：

```powershell
scripts\reinstall-local.ps1 -DshRoot <dsh 源码目录> -PluginRoot <插件目录>
```

脚本会打包插件、创建名为 `data-analysis` 的运行环境、安装依赖，并自动安装
`data-analysis` agent preset。完成后进入 dsh 源码目录启动：

```sh
cd <dsh 源码目录>
pnpm dsh --profile data-analysis
```

macOS 和 Linux 暂时没有自动重装脚本，优先使用发布包安装。

## 其他方式：使用发布包安装

如果插件已经发布到 npm，可以用下面的命令安装。

```sh
dsh plugin --profile data-analysis add @deepseek-ai/dsh-web-app@0.1.0-rc.6
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

发布包安装后，还需要从插件源码目录安装一次 `data-analysis` agent preset：

Windows：

```powershell
cd <插件目录>
scripts\install-preset.ps1
```

macOS / Linux：

```sh
cd <插件目录>
sh scripts/install-preset.sh
```

注意：

- 两条 `add` 命令必须分开执行，不要合并成一条。
- `@deepseek-ai/dsh-web-app` 必须保留版本号 `0.1.0-rc.6`，因为 npm 的 `latest` 标签目前仍指向更早版本。
- 安装完成后要重启 DeepSeek Harness，插件才会加载。

## 配置 Python 环境

Windows：

```powershell
scripts\setup-python.ps1
```

macOS / Linux：

```sh
./scripts/setup-python.sh
```

脚本会在插件根目录下创建 `.venv` 文件夹，安装数据分析需要的 Python 包，并提示你设置 `DSH_PYTHON` 环境变量。运行时只读取 `DSH_PYTHON`。

### Python 依赖包清单

`setup-python` 脚本会自动安装以下包：

| 包名 | 用途 |
| --- | --- |
| pandas | 数据读取、清洗和处理 |
| numpy | 数值计算 |
| matplotlib | 图表绘制 |
| scikit-learn | 机器学习建模 |
| pyarrow | Parquet 文件支持 |
| openpyxl | Excel (.xlsx) 文件读取 |
| xlrd | Excel (.xls) 文件读取 |
| xhtml2pdf | PDF 导出 |
| markdown | Markdown 转 HTML |

如需手动安装，可在插件根目录执行：

```sh
pip install -r requirements-data-analysis.txt
```

## 安装后怎么确认成功

先查看配置：

```sh
dsh --profile data-analysis --dump-config
```

你应该看到：

- 原来的 TypeScript 代码运行器处于关闭状态。
- Python 代码运行器已经加载。
- 数据分析工具和操作说明已经加载。
- 网页端的图表和报告展示模块已经加载。

然后启动：

```sh
dsh --profile data-analysis
```

打开 `http://127.0.0.1:3080`，给一个 CSV 文件的完整绝对路径做一次分析。如果页面能出现进度、图表和报告，就说明安装成功。

## 常见问题排查

### 构建失败：提示 `typescript/tsdown must be installed`

- 确认已在插件根目录执行过 `pnpm install`。
- 确认 pnpm 版本符合要求（`pnpm --version` 查看）。
- 尝试删除 `node_modules` 和 `pnpm-lock.yaml` 后重新 `pnpm install`。

### Python 找不到或报 `DSH_PYTHON` 错误

- 确认已运行 `scripts/setup-python.ps1`（Windows）或 `scripts/setup-python.sh`（macOS/Linux）。
- 确认环境变量 `DSH_PYTHON` 已设置，指向 `.venv/Scripts/python.exe`（Windows）或 `.venv/bin/python`（macOS/Linux）。
- 手动测试：在命令行执行 `%DSH_PYTHON% --version`（Windows）或 `$DSH_PYTHON --version`（macOS/Linux），应能输出版本号。

### 权限问题：脚本无法执行

- Windows：右键脚本选择"以管理员身份运行"，或在 PowerShell 中先执行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。
- macOS/Linux：执行 `chmod +x scripts/*.sh` 为脚本添加执行权限。

### PDF 导出失败，只得到 HTML 报告

- PDF 导出依赖 `xhtml2pdf`，确认 Python 环境中已安装该包。
- 某些系统可能缺少字体文件，导致 PDF 渲染异常。此时 HTML 报告仍然可用。

### 插件安装后启动看不到数据分析功能

- 确认使用的是 `data-analysis` profile（启动命令：`dsh --profile data-analysis`）。
- 执行 `dsh --profile data-analysis --dump-config` 检查配置是否正确加载。
- 重启 DeepSeek Harness，确保插件重新加载。

## 怎么卸载

在插件源码目录下运行卸载脚本。它会删除 `data-analysis` profile 和对应的
`data-analysis` agent preset，但不会删除会话历史。

Windows：

```powershell
scripts\uninstall.ps1
```

macOS / Linux：

```sh
sh scripts/uninstall.sh
```

如果你还想一起删除插件根目录下的 Python 环境 `.venv`：

Windows：

```powershell
scripts\uninstall.ps1 -RemoveVenv
```

macOS / Linux：

```sh
sh scripts/uninstall.sh --remove-venv
```
