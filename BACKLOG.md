# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：P1「文本静心祝福」**实现中**。用户已批准开工（"就按这个走吧，开工"），按 `/loop` 自定步调迭代，直到初版 Demo 跑通。
- **iteration 1-5 完成**：monorepo + 领域层 + 数据层 + application 用例 + Fastify HTTP API + **client**（React + Vite + CSS Modules，10 个页面，`api/client.ts` 唯一 fetch，`SessionProvider`）。**117 测试全绿**，`pnpm verify` 绿。全栈 smoke（server 3000 + vite 5173 proxy）：client 出 HTML、登录→协议→提交→占位→落地页 全通。
- **iteration 6（下一步，收尾）**：`pnpm dev` 双进程说明写进 README；跑一遍完整 demo 确认（可加 `@fastify/static` 让 `server start` 单进程也能出 client）；Playwright E2E 骨架（§7.4/7.5 占位）；把 tasks.md §7 端到端脚本落成实际测试；PROMPT_LOG / CHANGELOG 收尾 → **初版 Demo 完成**。
- **实现计划**：[openspec/changes/add-p1-text-blessing/tasks.md](openspec/changes/add-p1-text-blessing/tasks.md)（7 组任务）。逐组做，每组 commit + 勾选。
- **本机限制**：无 psql。数据层先做 `ports` + 内存 adapter（架构上就是可换的），Drizzle 迁移 + PG 集成测试作为需要 DB 的独立任务（B-24）。
- **技术栈**（已定，ADR 0003）：Web-first PWA（React+TS+Vite / CSS Modules）+ Node+TS（Fastify）+ PostgreSQL（Drizzle）+ pnpm monorepo，领域逻辑在 `packages/domain`。
- **关键文档**：[docs/product/vision.md](docs/product/vision.md) · [docs/product/use-cases.md](docs/product/use-cases.md) · [docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md) · [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md) · [openspec/changes/add-p1-text-blessing/](openspec/changes/add-p1-text-blessing/) · 走查原型 [prototype/](prototype/)（`npm run verify`）· 界面画布见 PROMPT_LOG 最新条目的链接。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。条件允许时派多 Agent 并行。每轮结束自动 commit + push（`.claude/hooks/auto-commit-push.sh`）。
- **下一步**：和用户一起过第二轮设计稿（画布 v2 已发布，链接见 PROMPT_LOG 最新条目）。

---

## 进行中

- [~] **P1 实现（loop）** — 按 openspec `tasks.md` 逐组推进。iteration 1：monorepo 骨架 + 迁 `packages/domain`（`pnpm install` / `pnpm verify` 待跑）。

## 待办

### P1 设计 / spec

- [ ] **B-09 界面稿第二轮评审** — 画布 v2 已发布，等用户点评。
- [ ] **B-04b 发心 / 送达文案打磨** — 引导框和送达页的连接感文案已就位，措辞还可以再走一遍（B-04 的框架已落地）。
- [ ] **B-05 定位自动获取城市** — 个人空间开定位授权 → 自动填城市。P1 占位；实现待定（浏览器 Geolocation + 逆地理编码，粒度到城市）。
- [ ] **B-06 复查"禁止粘贴"的取舍** — 无障碍（读屏 / 语音输入不受影响，辅助粘贴会）、正常用户改错想重贴一小段。可能退化为"拦大段 / 拦命中范本的粘贴"。B-03 已上简单版。

### 工程 / apply 阶段

- [ ] **B-20 建 pnpm monorepo 骨架**（`packages/domain|shared|config` + `server/` + `client/`）。
- [ ] **B-21 架构测试落地真实代码库**（dependency-cruiser 完整规则 + `*.arch.test.ts`），CI 独立步。
- [ ] **B-22 从 `prototype/` 迁 `packages/domain`**（lifecycle / visibility / streak / moderation + 测试）。
- [x] **B-20/B-22/B-23（部分）** monorepo 骨架 + 迁 `packages/domain` + ESLint/Prettier —— iteration 1 完成。
- [ ] **B-21 架构测试补全** — 依赖方向 / 无循环 / 无孤儿的规则已上；`eslint-plugin-boundaries` 的完整分层配置待补（现用 dependency-cruiser + no-restricted-imports）。
- [ ] **B-24 数据层落 PostgreSQL** — Drizzle schema + 迁移脚本 + testcontainers 集成测试。需要能跑 psql 的环境；开发阶段先用内存 adapter。
- [ ] **B-25 `packages/config`** — 共享 tsconfig / eslint 预设抽成包（现在直接放根目录）。
- [ ] **B-26 i18n 抽取** — client 现为字面中文；抽到 i18n 层（standards 要求"第一天"，为可读性 demo 阶段先字面）。
- [ ] **B-27 微信 H5 适配 + PWA** — JS-SDK 分享、`manifest.json`、Service Worker。
- [ ] **B-28 生产静态托管** — `@fastify/static` 服务 `client/dist` + SPA fallback，让单进程也能跑；或分开部署（ADR 0003 D12 推迟项）。
- [ ] **B-29 移除 `prototype/`** — monorepo 已功能对齐；确认后删。

### 待澄清 / 需用户或法务

- [ ] **B-40 "精选展示"默认开启的合规性** — 法务确认，见调研 ADR-M。
- [ ] **B-41 数值待定** — hold 时长目标 / 上限、链接有效期默认值、字数上下限、范本最终清单。见 use-cases 开放问题。
- [ ] **B-42 资金托管模式选型 + 公司主体 / 资质办理启动** — P3 前，见调研领域一 ADR-A…ADR-G。
- [ ] **B-43 openspec change `add-p1-text-blessing` 评审** — 通过后才 `/opsx:apply`。
