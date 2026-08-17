# AGENTS.md

本仓库是一个独立的 dsh 插件 monorepo。每个包都是 `@andy1797833970/dsh-*`，通过
`ctx.effect()` / `ctx.on()` 注册贡献，能力缝只 peer 依赖 dsh 的 Service
Definition（`@deepseek-ai/dsh-*`）。

## 规则

- 包源码在 `packages/<group>/<pkg>/src`，测试在 `packages/<group>/<pkg>/tests`。
- 不改 dsh 源码；要扩展用 profile patch、bundle 或运行时注册。
- 模型可见的东西必须落在 session 事件或技能文本里，不能依赖宿主内部状态。
- 部署可变的选项必须是包 `Config` 字段，不能在代码里硬编码。
- 每包 `README.md` 保留 Model Experience 与 Known Limitations 两节，内容与代码一致。

## 验证

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

发布前核对每包 `files` 已包含 `lib/*.js`、`lib/types/**/*.d.ts`、
`cordis.patch.yml`、`toolbox`。
