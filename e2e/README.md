# 端到端测试（Playwright）

真浏览器点一遍 P1 的关键旅程。独立于 monorepo：自己的 `npm` 依赖，不进 pnpm workspace。

## 跑

```bash
cd e2e
npm install
npm test
```

`playwright.config.ts` 的 `webServer` 会自动构建 client 并起 server（内存数据层，
`BW_HOLD_SECONDS=1` 把延迟送达缩到 1 秒），端口 3100。

## 浏览器

用**系统安装的 Chrome**（`channel: 'chrome'`），不下载 Playwright 自带的 chromium
—— 开发机是 macOS 12，新版 Playwright 不再为它提供 chromium 构建。CI 上如果用较新的
系统，可以改回 `npx playwright install chromium` + 去掉 `channel`。

## 覆盖的旅程

- `author-flow.spec.ts` —— 登录 → 个人空间设落款/城市 → 同意协议 → 写祝福（范本禁止粘贴、
  正文自己录入）→ 已发送 → hold 结束自动发布 → 访客看到正文 → 作者撤回 → 访客看到占位。
- `moderation.spec.ts` —— 命中护栏词停在校验中、进人工队列、审核台通过后送达；访客高危举报
  即时下架、审核台驳回举报后恢复可见。
- `visitor.spec.ts` —— 未知链接显示占位不报错；访客页不需要登录态。
- `smoke.spec.ts` —— 首页能打开。

## 和其它测试的关系

- 领域 / 应用 / 架构单测：仓库根 `pnpm verify`（Vitest）。
- PG 仓储集成测试：`server/src/infrastructure/pg/pg-repositories.test.ts`（PGlite，进程内）。
- 这里只放跨端到端、需要真浏览器的用例。
