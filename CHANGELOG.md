# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Docs

- 回补 `add-p1-text-blessing` 的 openspec delta 并归档（B-67）：该 change 实现完成后一直没归档，中间几轮点状修复（B-61/62/63/64）都只进了 BACKLOG/CHANGELOG，从没回头改它的 spec——归档前发现 spec 描述的还是"字数下限 15""撤回可重新发布""标签只能预设"这些过时行为。用 `/opsx:update` 逐条核对代码校正 `blessing-authoring` / `blessing-delivery` / `blessing-records` 三个能力的 delta（含两个新 scenario：撤回后不能重新发布、回信关联原祝福），顺带清理 `tasks.md` 里几处过时的复核项，`validate --strict` 通过后 `/opsx:archive`——10 个能力的主 spec 现在活在 `openspec/specs/`，是当前行为的权威来源。同步刷新 `docs/product/p1-acceptance-status.md` 的测试数与受影响用例证据。
- AGENTS.md §2 新增"spec 同步检查"：动手前判断改动是否触及某个 openspec 能力已描述的行为，触及则同一轮工作里同步改 spec，不能只记 BACKLOG/CHANGELOG——防止本轮"代码改了、spec 没跟"的情况重演。

### Added

- 标签支持自定义（B-61）：个人空间画像标签、写祝福页的受众筛选标签，此前只能从建议标签里点选。后端 schema（`audienceFilterSchema` / `profileUpdateSchema`）本就是自由字符串（≤20 字，≤10/12 个），只是客户端缺输入框。`Profile.tsx` / `Compose.tsx` 各加一个文本框 + 「添加」按钮（回车也可），复用现有标签 pill 渲染。
- 回信关联原祝福（B-64）：此前"回一段祝福"只记`replyToUserId`，不记是回哪一条——收件箱消息一多，发送者分不清一条回信对应自己群发出去的哪条祝福。`Blessing` 加 `replyToBlessingId`（提交时校验：该祝福必须存在且当事人确实是其收件人之一，否则后端忽略、不关联，防止伪造）；`InboxView` 加 `inReplyTo: { blessingId, bodyPreview }`；收件箱页在回信上方展示"回的是你那条：「...」"。落到 PGlite 需要新增一列（`drizzle/0001_chunky_maria_hill.sql`）。覆盖：domain/server 集成测试（含伪造 id 被忽略的用例）+ e2e。

### Fixed

- 撤回后点「重新发布」，对方收不到但发送者以为已发出（B-63）：根因是投递扇出的幂等标记 `deliveredAt` 只在首次发布时置位、撤回时不清空——`withdrawn → verifying → published` 的重新发布路径复用了同一条记录，`deliverIfNeeded` 一看 `deliveredAt` 已经有值就直接跳过扇出，状态却正常流转到 `published`，UI 显示"已送达"。这条路径此前完全没有测试覆盖。
  处理方式：不是"清空 deliveredAt 再投一次"式的修复，而是接受"撤回即终态"——撤回后唯一出路是删除，或复制正文另发一条全新的（新 id、`deliveredAt` 从 null 开始，天然不会被旧记录的幂等标记误伤）。移除 `republish` 触发器（`packages/domain` 状态机 / 类型）、application 方法、HTTP 路由；「发出的」页对已撤回条目从"重新发布"按钮改为"复制以供编辑"（跳转到写祝福页并预填正文，不触碰旧记录）。覆盖：domain 状态机测试（撤回只剩 `delete` 一条出边）+ 2 个新集成测试（旧记录不会被复制路径污染 / 新记录正常送达）+ 1 个新 e2e（撤回后确认没有重新发布按钮、复制预填正确、旧记录仍是占位）。

### Changed

- 祝福正文字数下限从 15 降到 5（B-62）：`packages/domain` `DEFAULT_CONFIG.bodyMinLen`；同步改 Compose 页提示文案与 DEMO.md 示例。上限仍是 500，`BW_BODY_MIN_LEN` 环境变量覆盖方式不变。

### Changed — P1 重定为「陌生人祝福 · 按条件群发」（B-60, [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md)）

- **模型**：P1 从"作者写给认识的人 → 生成分享链接 → 微信发给 TA"重做为"注册用户按条件群发给附近的陌生人 → 收件箱 + 通知 → 只能回一段祝福，不能对话"。原"祝福请求 / 匹配"整块移至 P2。
- **个人画像**：`user_profiles` 增经纬度（浏览器 Geolocation 或手填）、性别、出生年、标签。位置齐备才 `canBroadcast`，才被别人的受众筛选命中；对外只暴露城市 + 四舍五入到公里的距离。
- **受众筛选 + 预览**（新能力 `blessing-audience`）：距离半径 + 年龄区间 + 性别 + 标签（命中任一）。`packages/domain/src/audience.ts`（haversine + 匹配，纯函数）。`POST /api/audience/preview` 返回命中数 + 上限 + 距离最近的样本。
- **群发人数上限**：命中人数 ∈ [1, `maxAudienceSize`]（默认 10，`BW_MAX_AUDIENCE` 可调）才允许群发；0 → `audience_empty`，超上限 → `audience_too_large`。提交时定格收件人快照（`blessings.recipient_ids`），后加入 / 退出范围的人不影响。
- **投递扇出 + 收件箱**：祝福首次进入 `published` 时（`transitionAndPersist` 内），对每个快照收件人建 `inbox_items` + `notifications`，置 `delivered_at`（幂等，申诉恢复不重复）。收件箱按关联祝福**当前**状态实时渲染（撤回 / 下架 / 过期后收件箱里那条也变占位），每 3 秒自动刷新。
- **站内通知**（新能力 `notification`）：`blessing_received` + 未读数徽标（顶栏 4 秒轮询）。P1 无真实推送通道。
- **回一段祝福**：`scope=reply`，受众恒为对方一人，同样过校验。没有聊天 / 会话线程。
- **内容形态留白**：`blessings.content_type`（`text` / `audio` / `video`）+ `media` jsonb。P1 只创作 `text`，撰写页 `audio` / `video` tab 灰置"即将支持"。
- **审核目标调整**：从"宗教敛财护栏"为主改为过滤无效 / 垃圾 / 违规为主——刷屏 / 空 / 全标点 → `violation`（`low_effort`）；站外链接 / 联系方式 / 拉客敛财话术 → `suspect`（`contact_leak` / `solicitation`）；不评"写得好不好"。
- **公开链接降级**：`/p/:slug` 从"送达机制"改为"传播用"（转发带人来平台）。
- **数据层**：schema 增上述字段，新增 `notifications` 表，`inbox_items` 增 `read_at`；迁移重生成（P1 未上线，无数据迁移）；内存 + PGlite 两套实现同步更新。
- **前端**：个人空间加位置 / 性别 / 年龄 / 标签；撰写页加受众筛选 + 预览 + 形态 tab + 回复模式；新增收件箱页；顶栏通知徽标；Sent / Records / Home / Agreement 文案随之改。
- **测试**：domain `audience.test.ts`（10）+ moderation 重写；application `blessing-flow.test.ts` 与 `api-flow.test.ts` 改为多用户群发链路；`pg-repositories.test.ts` 在 PGlite 上同链路；E2E 9 个用多浏览器上下文模拟发送者 / 收件人。`pnpm verify` 绿（**137 测试**），`pnpm test:e2e` 绿（**9**），openspec `validate --strict` 通过。
- **文档**：新增 [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md)；[use-cases.md](docs/product/use-cases.md)、[p1-architecture.md](docs/architecture/p1-architecture.md)、[concept.md](docs/product/concept.md)、[DEMO.md](docs/DEMO.md)、[p1-acceptance-status.md](docs/product/p1-acceptance-status.md)、AGENTS.md §1 同步；openspec change 的 proposal / specs 重写（新增 `blessing-audience` / `notification` 能力）。

### Fixed

- Consent gate before composing (B-50): a new user who opened 写祝福 from the nav was never routed through the agreement page — `GET /api/agreement/current` always returns 200, so Compose's consent check never fired, and submit failed with a 403 whose message was a small line at the bottom of a long form (looked like nothing happened). `AgreementView` now carries `alreadyConsented`; Compose redirects to `/agreement` on entry when it's false, and also on a `consent_required` error from submit. Covered by a new api-flow assertion and an E2E test (verified to fail without the fix).

### Changed

- 「坚持」page renamed to 「回响」(B-51): reframed around 送人玫瑰手有余香 — the cumulative count of blessings sent is the headline; the consecutive-days number is demoted to one soft line, dropping the habit-tracker pressure that clashed with the product's "不必赶" tone. Client copy only; the domain `streak` module is unchanged.
- Sent page (B-52) now states the recipient just opens the link — no registration, no login — since P1 has no in-app user→user delivery.

### Added

- Project scaffolding: README, AGENTS.md, PROMPT_LOG, ADR/product doc structure.
- OpenSpec adopted as the requirement lifecycle tool (Spec → review → TDD → implementation), see [ADR 0002](docs/adr/0002-openspec-for-requirement-lifecycle.md). Adds `openspec/` and `.claude/commands/opsx/*` + `.claude/skills/openspec-*`.
- Product vision / North Star (`docs/product/vision.md`): mission, positioning (a "focus + goodwill" space anchored to mindfulness, explicitly not a religious tool), and 5 design tie-breaker principles.
- `docs/product/concept.md` updated (v4): beachhead as a go-to-market wedge only, P1 scope locked (text-only blessings + personalization + shareable card, no AI eval, no funds), funds deferred to P3 with a licensed-custody / anti-"二清" direction, bounty framed strictly as service reward (not fundraising).
- `docs/product/capabilities.md` (v0): backend capability map — 15 domains (C1–C15) plus cross-cutting non-functionals, tagged by rollout phase; C3/C4/C9/C13 refined per research.
- `docs/research/` convention added (AGENTS.md §5, README); first report `docs/research/2026-09-01-funds-ai-licensing.md` — China funds-compliance, AI quality-evaluation, and UGC-licensing findings with an ADR checklist (ADR-A…ADR-Q).
- `docs/product/use-cases.md` (v0): P1 use cases (P1-UC-01…14), key data objects, and open questions for review.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) (Proposed): P1 tech stack — Web-first (React + TS + Vite PWA, Node + TS backend, PostgreSQL), WeChat web OAuth, pluggable `ModerationProvider`; mini-program deferred to a post-P2 decision point.
- `docs/architecture/p1-architecture.md`: P1 component view, blessing state machine, publish-then-verify / delayed-delivery model, streak rollback rules, data model, API sketch.
- openspec change `add-p1-text-blessing`: proposal + 6 capability spec deltas (wx-account, content-agreement, blessing-authoring, blessing-delivery, content-moderation, blessing-streak) + design + tasks; passes `openspec validate --strict`.
- `prototype/`: runnable P1 walkthrough spike (React PWA + pure-function domain modules) with 101 passing tests. Not production code.
- `docs/design/p1/`: P1 UI walkthrough as a Claude Design canvas (9 mobile artboards).
- `docs/product/p1-acceptance-status.md`: per-use-case status of P1 acceptance criteria against the prototype.
- `docs/architecture/` and `docs/design/` conventions added (AGENTS.md §5); `.gitignore` now ignores `node_modules/`, `dist/`.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) moved to Accepted (core items): D1 Web-first PWA, D4 Node.js+TS, D6 PostgreSQL, D10 rule-based moderation for P1; includes a long-term-fitness review.
- `docs/engineering/coding-standards.md` (v1): the technical code standard all production code must follow — layering, TypeScript, comments, API/DB conventions, concurrency & performance, security, testing, review checklist.
- Git workflow: `.claude/hooks/auto-commit-push.sh` (Stop hook) auto-commits and pushes to `main` after every turn; AGENTS.md §7 documents it.
- `coding-standards.md`: §7.1 mandates plain human-language comments (no marketing / "AI-register" phrasing); §3.1 adds architecture fitness-function tests (dependency-cruiser + `*.arch.test.ts`) as an independent suite run first in CI.
- `prototype/`: architecture tests wired up — `.dependency-cruiser.cjs` + `src/arch/architecture.arch.test.ts`, `test:arch` and `verify` scripts. `npm run verify` green (typecheck + arch + 108 tests + build).
- **P1 初版 Demo（生产 monorepo）**: `packages/domain` (pure logic) + `packages/shared` (Zod/error codes) + `server/` (Fastify, hexagonal layers, in-memory repos, scan jobs, static hosting) + `client/` (React + Vite + CSS Modules, 10 pages) + `arch/` (architecture tests). `pnpm demo` runs the whole flow single-process; `pnpm verify` green (typecheck, 0 dependency-cruiser violations, 119 tests incl. 7 `app.inject` end-to-end, build, eslint, prettier). openspec change `add-p1-text-blessing` §1–§7 implemented; `validate --strict` passes. Data layer is in-memory — PostgreSQL, real WeChat auth, real content-safety API are in BACKLOG. Walkthrough: `docs/DEMO.md`.
- `BACKLOG.md` (root): running task list + work-resume anchor. AGENTS.md / CLAUDE.md now say to read it at session start. Working method (point-by-point review iteration, parallel agents) added as AGENTS.md §8.
- PostgreSQL data layer (B-24): Drizzle schema for all 10 P1 tables (`server/src/infrastructure/db/schema.ts`), generated migration (`server/drizzle/`), and a full `Repositories` implementation against Drizzle (`server/src/infrastructure/pg/pg-repositories.ts`) sharing the same ports as the in-memory version — blessing events live in their own table and are rehydrated on read. Runs on PGlite (Postgres compiled to WASM, in-process, no local Postgres install needed); `BW_DB=pglite` selects it, in-memory stays the default. 5 integration tests run the whole application stack against real SQL, in-process, CI-safe. Swapping to a standalone Postgres in production is a one-layer driver change. Homebrew on this machine can't build Postgres (`openssl@3: unknown keyword :overwrite`), hence PGlite.
- Playwright end-to-end tests (B-30): standalone `e2e/` (own npm, not in the workspace). Drives the system-installed Chrome (`channel: 'chrome'`) because Playwright no longer ships a chromium build for macOS 12. `webServer` builds the client and starts the server with a 1-second delivery hold. 6 tests: author flow (login → profile → agreement → compose with paste blocked → sent → auto-publish → visitor sees content → withdraw → visitor sees placeholder), moderation (guardrail-word hold → queue → pass → delivered; high-risk report → takedown → appeal → restored), visitor (unknown link placeholder, no login needed), smoke. `pnpm test:e2e` runs them; not part of `pnpm verify`.
- Design canvas v2 approved (B-09).
- `docs/product/p1-acceptance-status.md` rewritten against the production monorepo (B-31): per-use-case evidence now points at real files and tests in `packages/domain` / `server/` / `client/` / `e2e/`, a new data-layer / deployment section, and a refreshed "pending your call" list (ADR 0003 accepted, openspec change awaiting archive, timing of real WeChat / moderation APIs, `prototype/` removal).
- Design review round 1 folded into spec + canvas + prototype: compose form trimmed to 3 sender fields (给谁 / 落款 / 城市), templates are reference-only (no one-click fill, body must be typed, paste blocked), an intention-setting prompt before writing; new `user-profile` capability (个人空间) pre-sets 落款 / 城市 / preferences; "我的祝福" → "收发记录" with outbox (P1) + inbox (empty state, `blessing-records` capability). openspec change now covers 8 capabilities; `openspec validate --strict` green. Prototype `npm run verify` green (108 tests). Canvas republished (v2, +个人空间 artboard).
