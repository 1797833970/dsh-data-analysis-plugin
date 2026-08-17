# 安装、删除与重装

## 前置条件

- 一个可运行的 DeepSeek Harness：目前 dsh 尚未发布，需使用
  [`deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 源码
  checkout（`pnpm install && pnpm build` 或直接用源码启动）。
- Python 3.11+，先运行 `scripts/setup-python.ps1` / `setup-python.sh`。
- `DSH_PYTHON` 指向该 Python 解释器。

## 第一步：私有发布到 GitHub

1. 在 GitHub 新建**私有**仓库 `dsh-data-analysis-plugin`（不要初始化 README）。
2. 推送本仓库：

   ```sh
   git remote add origin https://github.com/<你>/dsh-data-analysis-plugin.git
   git push -u origin main
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

### 方式 A：本地路径（dsh 未发布时可用）

在 dsh 源码 checkout 与 `dsh-data-analysis-plugin` 同级的前提下：

```sh
dsh plugin --profile data-analysis add \
  "file:$(pwd)/data-analysis-plugin/packages/data-analysis/bundle-data-analysis"
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

`file:` 依赖会把 bundle 及其 `@andy1797833970/*` 子包一起装入 profile；
`@deepseek-ai/*` peer 依赖从 dsh 安装的 healed fallback 解析。

### 方式 B：npm 安装（dsh 发布后）

```sh
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

## 第四步：验证

打开 `http://127.0.0.1:3080`，给一个 CSV 的完整绝对路径做一次分析，确认
`loaded.parquet` / `clean.parquet` 出现在会话工作目录且能出图出报告。
