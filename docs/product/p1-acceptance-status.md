# P1 验收状态（陌生人群发模型 · 对照生产 monorepo）

> 2026-09-04：按 [ADR 0004](../adr/0004-p1-stranger-broadcast-model.md) 重写。对照 [use-cases.md](use-cases.md) v1 的验收标准。
> 图例：✅ 已实现且有自动化测试　🟡 部分 / 简化实现　⬜ 需接真实第三方　❓ 待评审

## 一句话结论

P1「陌生人祝福 · 按条件群发」的核心链路已在生产分层代码里实现：`pnpm verify` 绿（**137 进程内测试**，含 8 个 Fastify HTTP 端到端 + 5 个跑真实 SQL 的 PGlite 集成 + domain 的 audience/moderation/lifecycle 纯函数测试），`pnpm test:e2e` 绿（**9 个真浏览器 Playwright**，多浏览器上下文模拟发送者 / 收件人）。数据层内存 + PGlite 两套同 ports 实现。外部依赖（微信授权、真实内容安全 API、逆地理编码、真实推送）按接口留位，P1 用 stub / 规则实现。

## 逐用例

| UC | 状态 | 证据 |
|---|---|---|
| UC-01 微信登录 | ✅ / ⬜真实授权 | `auth-service.ts`（openid 幂等）；`in-memory-repositories.test.ts`、`pg-repositories.test.ts` |
| UC-02 完善画像（位置/性别/年龄/标签） | ✅ | `profile-service.ts`（`canBroadcast`）；`client/.../Profile.tsx`（Geolocation + 手填 + 标签 chips）；`api-flow.test.ts` setProfile |
| UC-03 同意协议 | ✅ | `consent-service.ts`（`alreadyConsented`）；`Compose.tsx` 进页即判、submit 撞 `consent_required` 也跳；`api-flow.test.ts`「同意前 false / 同意后 true」+ E2E「新用户进 /compose → 跳 /agreement」 |
| UC-04 范本参考 | ✅ | `templates-seed.ts`（18 条，每类 ≥3）；`api-flow.test.ts`；`Compose.tsx` 无一键填入、`user-select:none` |
| UC-05 撰写（含 contentType 留白） | ✅ | `blessing-service.ts`（`contentType != text` 拒绝、字数校验）；`blessing-flow.test.ts`「语音 / 视频暂不支持」「正文太短」；`Compose.tsx` 形式 tab |
| UC-06 草稿 | ✅ | `draft-service.ts`（body + occasion + audience）；`Compose` 自动存 |
| UC-07 受众预览 | ✅ | `audience-service.ts` + `packages/domain/src/audience.ts`；`audience.test.ts`（10）、`blessing-flow.test.ts`「预览命中范围内的人，不含自己和范围外」、`api-flow.test.ts` `/api/audience/preview` |
| UC-08 按条件群发 + 人数上限 | ✅ | `blessing-service.submit`（resolve + 快照）；`blessing-flow.test.ts`「audience_empty」「audience_too_large（cap=1）」「location_required」；E2E「范围里没有人 → 发送按钮不可用」 |
| UC-09 发布即校验 / 延迟送达 | ✅ | `blessing-write.ts`（`transitionAndPersist` + `deliverIfNeeded` 幂等）、`scans.ts`、`moderation/apply.ts`；`blessing-flow.test.ts` 三档各一条、`pg-repositories.test.ts` 同链路真 SQL |
| UC-10 收件箱 | ✅ | `inbox-service.ts`（按 `blessing.state` 现算、发送者粗粒度信息、距离四舍五入）；`Inbox.tsx`（3s 轮询）；`blessing-flow.test.ts`「撤回后收件人看占位」、E2E「群发 → 收件箱收到」「撤回 → 占位」 |
| UC-11 站内通知 | ✅ / ⬜真实推送 | `notification-service.ts`；`App.tsx` 未读徽标（4s 轮询）；`blessing-flow.test.ts`「未读通知」、`api-flow.test.ts` `/api/notifications` |
| UC-12 回一段祝福 | ✅ | `blessing-service.submit`（`scope=reply`）；`blessing-flow.test.ts`「收件人回一段 → 原发送者收件箱出现」「不能回复自己」；E2E 回信链路 |
| UC-13 发件箱管理 | ✅ | `blessing-service.ts`（withdraw/republish/delete/renew）；`Records.tsx`；`blessing-flow.test.ts` / `api-flow.test.ts` / `pg` 撤回 + 回响回撤、到期 + 续期 |
| UC-14 公开链接 + 访客查看 | ✅ | `blessing-service.getPublicPage`（非 content 只回占位枚举）；`PublicPage.tsx`；`visitor.spec.ts` |
| UC-15 举报 | ✅ | `report-service.ts`（匿名 / 指纹 / 同源合并 / 高危即时下架）；`api-flow.test.ts`「举报高危 → 即时占位 + 优先级 90」；`moderation.spec.ts` |
| UC-16 审核队列 | ✅ / ⬜角色鉴权 | `moderation-queue-service.ts`；`Moderation.tsx`；`api-flow.test.ts`「护栏词 → 队列 → 通过 → 投递」、`moderation.spec.ts` 两条 |
| UC-17 回响 | ✅ | `packages/domain/src/streak.ts` + `streak-service.ts`；`Streak.tsx`（"送人玫瑰手有余香"文案）；`streak.test.ts`（12，跨时区）；过期不回撤已测 |

## 数据层 / 部署

- ✅ 全 11 张表 Drizzle schema + 重生成迁移（`server/drizzle/`）；PG 实现全仓储同 ports；5 个集成测试整栈跑真实 SQL（`BW_DB=pglite`）。
- ✅ 单进程静态托管（`pnpm demo`）。
- ⬜ 独立生产 Postgres（换 `drizzle-orm/postgres-js` 驱动一层）；分开部署方案。

## 待评审 / 待第三方

1. `maxAudienceSize`（测试期 10）、受众半径上下限、hold / TTL / 字数等数值 —— `packages/domain/src/config.ts`。
2. 真实微信网页授权、真实内容安全 API、逆地理编码、真实推送通道 —— 需账号，接口已留位。
3. "精选展示默认开启"的合规性 —— 待法务（ADR-M）。
4. openspec change `add-p1-text-blessing`（已按 ADR 0004 重定、`validate --strict` 通过）—— 评审后 `/opsx:archive`。
5. 是否删 `prototype/`（monorepo 已远超其功能）。
