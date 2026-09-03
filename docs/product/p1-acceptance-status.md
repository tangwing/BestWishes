# P1 验收状态（对照生产 monorepo）

> 初版生成于 2026-09-02（对照 `prototype/`）；2026-09-03 改为对照生产 monorepo（`packages/domain` · `packages/shared` · `server/` · `client/` · `e2e/`）。
> 对照 [use-cases.md](use-cases.md) 的 P1 验收标准，逐条标注实现状态与自动化测试证据。
> 图例：✅ 已实现且有自动化测试　🟡 部分 / 简化实现　⬜ 需接真实第三方（真实微信授权 / 真实内容安全 API / 独立部署）　❓ 需你评审拍板

## 一句话结论

P1 的**领域规则**（祝福状态机、发布即校验 / 延迟送达、可见性投影、坚持记录及其回撤、审核三档判定、举报合并与高危下架、链接过期与续期）已在生产分层代码里实现，`pnpm verify` 绿——**124 个进程内测试**（含 7 个 Fastify `app.inject` HTTP 端到端 + 5 个跑真实 SQL 的 PGlite 集成），另有 **6 个真浏览器 Playwright E2E**（`pnpm test:e2e`）。数据层是**内存 + PGlite（WASM Postgres，真 SQL）两套同 ports 实现**，`BW_DB` 切换；换独立 Postgres 只改 Drizzle 驱动一层（B-24b）。**外部依赖**（微信网页授权、真实内容安全 API、独立生产部署）按 ADR 0003 做成可替换接口，当前用 stub / 规则实现，需账号才能自验，留给收尾阶段。

## 逐用例

### P1-UC-01 微信登录 / 注册
- ✅ 同一身份只对应一个账户、回调重试幂等 —— `auth-service.ts` 以 `openid`（占位期 `stub:<nickname>`）`findOrCreateByOpenid`；`server/src/infrastructure/memory/in-memory-repositories.test.ts`「同一 openid 多次 findOrCreate 只建一个账户」、`server/src/infrastructure/pg/pg-repositories.test.ts` 同链路跑真实 SQL
- ✅ 拒绝昵称 / 头像仍可建号 —— `auth-service.ts` 昵称即占位身份，`avatarUrl: null`
- ✅ 未登录访客能看落地页、不能进创作 —— `client/src/app/pages/Home.tsx` / `PublicPage.tsx` 无登录墙；`Compose.tsx` 未登录跳转登录；`api-flow.test.ts`「缺协议 → 403」等链路
- ⬜ 真实微信网页授权（OAuth2 + JS-SDK）、openid / unionid —— 接口位在 `auth-service.ts`（注释已标「真实回调接进来时 openid 幂等这条不变」），路由现为 `POST /api/auth/stub-login`

### P1-UC-02 同意《用户内容与授权协议》
- ✅ 必选项拒绝则不放行、逐项留痕 —— `consent-service.ts` + `blessing-write.ts` 校验；`blessing-flow.test.ts`「没同意协议不能提交」、`api-flow.test.ts`「缺协议 → 提交 403 consent_required」
- ✅ 精选展示默认值可配置（默认开 ↔ opt-in）—— `app-config.ts` `featuredDefaultOn`（`BW_FEATURED_DEFAULT_ON` 覆盖）；`content-agreement` spec 有对应 scenario
- 🟡 协议改版重新确认 —— 数据结构支持（`agreementVersion`），UI 未做改版弹层
- ❓ 「精选展示默认开」的合规性 —— 待法务；`docs/research/2026-09-01-funds-ai-licensing.md` 已标 PIPL 风险（ADR-M）

### P1-UC-03 范本库 / 自由创作
- ✅ 每类 ≥3 条、护栏词校验 —— `infrastructure/templates-seed.ts`；`api-flow.test.ts`「范本接口返回参考范本（每类 ≥3）」（共 ≥18）、`pg-repositories.test.ts`「范本种子写入并读回（共 ≥18）」
- ✅ 加载失败回退自由创作 —— `client/src/app/pages/Compose.tsx` 范本请求失败分支
- ✅ 范本仅供参考、不一键填充、正文必须手输 —— B-09 评审结论，`Compose.tsx` 无一键填充；`blessing-authoring` spec

### P1-UC-04 撰写 + 个性化信息
- ✅ 正文 + 称呼必填、字数上下限 —— `blessing-write.ts` 校验；`blessing-flow.test.ts`「正文太短被拒」「缺『给谁』被拒」
- ✅ 个性化字段与正文分开存储 —— `BlessingRecord.personalization` 独立结构（`ports/records.ts`），PG 里独立列（`infrastructure/db/schema.ts`）
- ✅ 城市粒度不超过城市级 —— 输入为自由文本城市名，无定位采集（B-05 待办）
- ✅ 静心引导、无计时无评分 —— `Compose.tsx` 呼吸动效 + 发心引导框；`blessing-authoring` spec scenario

### P1-UC-05 草稿
- ✅ 自动保存、不触发审核、不生成链接、可恢复、发布后清理 —— `draft-service.ts`；`client/src/app/pages/Compose.tsx` 自动存取
- ✅ 不对他人可见 —— 按 `authorId` 存取

### P1-UC-06 自动内容合规检查（发布即校验、延迟送达）
- ✅ 作者「已发送」与接收方「可见」是两个独立状态 —— `blessing-write.ts` 提交即返回 slug + `verifying`，`application/scans.ts` `publishReady()` 到点转 `published`；`blessing-flow.test.ts`「提交后 verifying，访客看到『准备中』」
- ✅ 校验期访客看占位、不返回正文 —— `blessing-service.ts` `getPublicPage` 非 content 只回类型 + 占位文案；`blessing-flow.test.ts` 断言 `page.content` 为 undefined、`api-flow.test.ts` 同链路走 HTTP
- ✅ pass → 送达 / suspect → 保持校验 + 进队列 / violation → 下架占位 —— `packages/domain/src/moderation/apply.ts` + `moderation-queue-service.ts`；`moderation/apply.test.ts`（6）、`blessing-flow.test.ts` 三档各一条端到端、`api-flow.test.ts`「命中护栏词 → suspect → 进队列 → 人工通过 → 送达」
- ✅ 审核服务不可用 → 保守（维持 hold + 进队列）—— `moderation/apply.ts` 对 unavailable 档的处理；domain 测试覆盖
- ✅ 留痕（档位、命中大类、hold 时长）—— `BlessingRecord.moderation` + `blessing_events` 子表，PG 读取时回填 events 数组（`pg-repositories.test.ts`「事件从子表拼回」）
- 🟡 hold 超时升级 —— `app-config.ts` `holdTimeoutHours` + `scans.ts` 打标记，未接通知渠道
- ⬜ 真实内容安全 API —— `ModerationProvider` 端口已定义，规则实现 `packages/domain/src/moderation/ruleBased.ts`（`ruleBased.test.ts` 10 条），云厂商实现待接（D10 = B）

### P1-UC-07 生成可分享卡片 / 落地页
- ✅ 链接立即可分享、按状态渲染、非微信浏览器可开 —— `client/src/app/pages/Sent.tsx` / `PublicPage.tsx`（普通 Web 页）；`e2e/tests/visitor.spec.ts`「未知 slug 占位、无需登录」
- ✅ 不暴露 openid / 精确位置 / 手机号 —— `getPublicPage` 只回城市 + 昵称拼的 `fromLine`；`blessing-flow.test.ts`「来自 杭州 的 小林」
- ✅ 链接有效期 + 作者可续期 —— `app-config.ts` `linkTtlDays`、`blessing-service.ts` `renew`、`scans.ts` `expire()`；`blessing-flow.test.ts` / `api-flow.test.ts`「到期 → expired 占位 → 续期 → 恢复可见（不重新审核）」
- ✅ 无 AI 生成标识、有「内容由用户创作」位 —— `PublicPage.tsx`

### P1-UC-08 微信分享
- 🟡 调起微信分享 —— `Sent.tsx` 有按钮位，真实版接 JS-SDK（B-27）；复制链接兜底已实现
- ✅ 同一祝福多次分享指向同一稳定链接 —— slug 固定
- ✅ 访客点击直达查看页、无需注册 —— 路由 `/p/:slug` 无登录墙；`e2e/tests/visitor.spec.ts`

### P1-UC-09 访客查看
- ✅ 无登录墙、按状态渲染（正文 / 准备中 / 已收回 / 已下架 / 已过期 / 未找到）—— `packages/domain/src/visibility.ts` + `PublicPage.tsx`；`visibility.test.ts`（16）
- ✅ 撤回 / 过期 / 下架后不再返回正文 —— `getPublicPage` 每次实时判定；`blessing-flow.test.ts` /`api-flow.test.ts`「撤回 → 访客看到占位」、`pg-repositories.test.ts`「撤回 → 访客看占位」
- ✅ 占位文案中性、不泄露原文、不报技术错误 —— `visibility.ts` 占位文案常量
- 🟡 「60 秒内失效」—— 进程内即时失效（无缓存层）；生产需覆盖 CDN / 边缘缓存策略

### P1-UC-10 访客一键致意
- ⬜ 不进 P1（已决定，移至 P4）

### P1-UC-11 作者管理（撤回 / 取消 / 重新发布 / 删除 / 续期）
- ✅ 撤回即时可逆、删除二次确认 + 不可逆、删除后不在列表 —— `blessing-service.ts` + `client/src/app/pages/Records.tsx`
- ✅ **校验期可取消**（`verifying → withdrawn`，清除待发布）—— `blessing-service.ts` `withdraw`；`blessing-flow.test.ts`「校验期可取消」（advance 后 `publishReady()` 返回 0）
- ✅ 重新发布重新走校验 —— `blessing-service.ts` `republish` 重新跑审核 + 重置 hold
- ✅ 撤回 / 删除 / 下架回撤坚持记录计数；**链接过期不回撤** —— `blessing-flow.test.ts`「撤回后坚持记录回撤」「过期不回撤坚持记录」、`api-flow.test.ts` 同、`pg-repositories.test.ts`「撤回 → 坚持记录回撤到 0」
- ✅ 「已分发副本无法追回」告知 —— `Records.tsx` 删除 confirm 文案

### P1-UC-12 坚持记录
- ✅ 按作者所在地区自然日、仅本人可见、不转积分 / 等级 —— `packages/domain/src/streak.ts` + `client/src/app/pages/Streak.tsx`；`streak.test.ts`（12，含跨时区）
- ✅ 计数与「published 且未过期」集合一致 —— streak 挂在状态转移上（`streak-service.ts`）
- ✅ **链接过期不扣坚持记录**（2026-09-02 用户确认）—— 只有撤回 / 删除 / 下架回撤；spec + domain + 测试已改

### P1-UC-13 举报
- ✅ 匿名可提交、同源合并计数、高危即时临时下架、举报人不获知作者身份 —— `report-service.ts`；`api-flow.test.ts`「举报高危 → 即时占位 + 进审核队列 → 人工通过恢复」、`e2e/tests/moderation.spec.ts` 高危下架 → 申诉 → 恢复
- 🟡 防滥用（频率 / 指纹）—— 记录了 `reporterFingerprint`，限频逻辑未实现

### P1-UC-14 审核队列
- ✅ 优先级排序、复核动作驱动状态机 + 留痕、每工单有终态 —— `moderation-queue-service.ts` + `client/src/app/pages/Moderation.tsx`；`in-memory-repositories.test.ts`「listOpen 按优先级降序」、`api-flow.test.ts` queue 首项 `priority === 90` / `origin === 'auto_suspect'`
- 🟡 审核员分级 / 二审 / 抽检执行 —— 数据结构留位（`priority`、`origin`），流程未完整实现
- ⬜ 角色鉴权 —— 现不鉴权（会话即作者本人）

## 数据层 / 部署（对照 monorepo 新增一节）

- ✅ 全 10 张 P1 表 Drizzle schema + 生成迁移（`server/src/infrastructure/db/schema.ts` · `server/drizzle/0000_init.sql`）
- ✅ 10 个仓储的 PG 实现，与内存版同 ports（`server/src/infrastructure/pg/pg-repositories.ts`）；5 个集成测试整栈跑真实 SQL（`pg-repositories.test.ts`），`BW_DB=pglite` 选用，内存仍默认
- ✅ 单进程静态托管 —— `@fastify/static` 服务 `client/dist` + SPA fallback（`server/src/interface/http/static.ts`），`pnpm demo` 走完整链路
- ⬜ 独立生产 Postgres —— B-24b：加 `drizzle-orm/postgres-js` 驱动分支 + `DATABASE_URL`，schema / 仓储 / 迁移不动
- ⬜ 分开部署方案（client / server 独立托管）—— ADR 0003 D12 推迟项

## 待你拍板

1. ~~链接过期是否扣坚持记录~~ —— **已定（09-02）：不扣。**
2. ~~校验期作者能否撤回~~ —— **已定（09-02）：可以。**
3. ~~ADR 0003（技术栈）~~ —— **已定（Accepted 核心项）：Web-first PWA + Node/TS + PostgreSQL + 规则审核。**
4. **openspec change `add-p1-text-blessing`** —— §1–§7 已实现、`validate --strict` 通过；待正式评审后 `/opsx:archive`（B-43）。
5. **「精选展示默认开启」的合规性** —— 需法务；代码已做成配置项（B-40）。
6. **真实微信网页授权、真实内容安全 API 的接入时机** —— 需微信开放平台 / 云厂商账号；接口位已留。
7. **移除 `prototype/`** —— monorepo 已功能对齐，确认后删（B-29）。
