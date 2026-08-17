# 安装、删除与重装

## 前置条件

- 一个可运行的 DeepSeek Harness：目前 dsh 尚未发布，需使用
  [`deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 源码
  checkout（`pnpm install && pnpm build` 或直接用源码启动）。
- Python 3.11+，先运行 `scripts/setup-python.ps1` / `setup-python.sh`。
- `DSH_PYTHON` 指向该 Python 解释器。

## 第一步：公开发布到 GitHub

仓库公开地址：

```sh
git clone https://github.com/1797833970/dsh-data-analysis-plugin.git
```

## 第二步：删除本地旧插件

如果之前用 dsh 源码内的原型跑过，删除并还原 dsh：

```sh
# 删除 dsh 源码里的原型包
rm -rf packages/data-analysis
rm -rf packages/code-runtime/code-runtime-python
rm -rf packages/client/ui-data-analysis
```

然后还原 dsh 源码两处改动：`packages/boot/app-boot/src/profile.ts` 里删除
`'data-analysis'` 模板；`packages/bundle/web-app/cordis.patch.yml` 删除
`ui-data-analysis` 行及 `web-app/package.json` 对应依赖。

## 第三步：重新安装

### 方式 A：本地路径（开发 / dsh 未发布时可用）

先构建本仓库：

```sh
pnpm install
pnpm build
scripts/reinstall-local.ps1
```

脚本会打包 4 个 `@andy1797833970/*` 包 → 创建 `data-analysis` profile → 用
`pnpm.overrides` 把内部依赖重定向到本地 tarball → `pnpm install` → 打印启动
命令。

### 方式 B：npm 安装（dsh 发布后）

```sh
dsh plugin --profile data-analysis add @deepseek-ai/dsh-web-app@0.1.0-rc.6 @andy1797833970/dsh-bundle-data-analysis@0.1.0-rc.5
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

## 第四步：验证

打开 `http://127.0.0.1:3080`，给一个 CSV 的完整绝对路径做一次分析，确认
`loaded.parquet` / `clean.parquet` 出现在会话工作目录且能出图出报告。
