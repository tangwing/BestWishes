# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：P1「文本静心祝福」**初版 Demo 完成 + PostgreSQL 数据层 + Playwright E2E**。`pnpm demo` 起单进程走完整链路。`pnpm verify` 绿，**124 测试**（含 7 个 `app.inject` 端到端 + 5 个 PGlite 集成）。`cd e2e && npm test` 绿（6 个真浏览器）。openspec `validate --strict` 通过。
- **代码**：`packages/domain`（纯领域逻辑）· `packages/shared`（Zod / 错误码）· `server/`（Fastify，分层 interface/application/infrastructure/ports；数据层 **内存 + PGlite 两套同 ports 实现**，`BW_DB` 切换；扫描任务 + 静态托管）· `client/`（React + Vite + CSS Modules，10 页）· `arch/`（架构测试）· `e2e/`（Playwright，独立 npm）。
- **走查**：见 [docs/DEMO.md](docs/DEMO.md)。
- **实现计划**：[openspec/changes/add-p1-text-blessing/tasks.md](openspec/changes/add-p1-text-blessing/tasks.md)。§1-§6 基本勾完，§7 端到端测试到位。
- **下一步选项**（等用户定）：(a) 真实微信网页授权（用户说"晚一些"）；(b) 真实内容审核 API（D10=B，收尾 / P2）；(c) 界面继续迭代（B-04b 等）；(d) `/opsx:archive` 归档这个 change 并开 P2。
- **本机限制**：① Homebrew 坏（`openssl@3: unknown keyword :overwrite`），装不了原生 Postgres → 数据层用 **PGlite**（WASM Postgres，进程内，真 SQL）；生产换独立 PG = 换 `drizzle-orm/postgres-js` 驱动一层。② macOS 12，新版 Playwright 无 chromium 构建 → E2E 用**系统 Chrome**（`channel: 'chrome'`）；CI 用较新系统可换回自带 chromium。
- **技术栈**（已定，ADR 0003）：Web-first PWA（React+TS+Vite / CSS Modules）+ Node+TS（Fastify）+ PostgreSQL（Drizzle）+ pnpm monorepo，领域逻辑在 `packages/domain`。
- **关键文档**：[docs/product/vision.md](docs/product/vision.md) · [docs/product/use-cases.md](docs/product/use-cases.md) · [docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md) · [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md) · [openspec/changes/add-p1-text-blessing/](openspec/changes/add-p1-text-blessing/) · 走查原型 [prototype/](prototype/)（`npm run verify`）· 界面画布见 PROMPT_LOG 最新条目的链接。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。条件允许时派多 Agent 并行。每轮结束自动 commit + push（`.claude/hooks/auto-commit-push.sh`）。
- **下一步**：等用户回来验收 PG 数据层 + E2E；决定真实微信授权 / 审核 API 的时机、是否 `/opsx:archive` 归档 change、是否删 `prototype/`。验收状态文档已对齐 monorepo（[docs/product/p1-acceptance-status.md](docs/product/p1-acceptance-status.md)，B-31）。

---

## 刚完成（下轮挪进 CHANGELOG）

- [x] **B-31 更新 p1-acceptance-status.md** — 从对照 `prototype/` 改为对照生产 monorepo：逐用例证据指向 `packages/domain` / `server/` / `client/` / `e2e/` 的真实文件与测试，新增「数据层 / 部署」一节，「待你拍板」更新为当前状态（ADR 0003 已定、openspec 待归档、微信 / 审核 API 接入时机、prototype 移除）。

## 待办

### P1 设计 / spec

- [ ] **B-04b 发心 / 送达文案打磨** — 引导框和送达页的连接感文案已就位，措辞还可以再走一遍（B-04 的框架已落地）。
- [ ] **B-05 定位自动获取城市** — 个人空间开定位授权 → 自动填城市。P1 占位；实现待定（浏览器 Geolocation + 逆地理编码，粒度到城市）。
- [ ] **B-06 复查"禁止粘贴"的取舍** — 无障碍（读屏 / 语音输入不受影响，辅助粘贴会）、正常用户改错想重贴一小段。可能退化为"拦大段 / 拦命中范本的粘贴"。B-03 已上简单版。

### 工程 / apply 阶段

- [ ] **B-20 建 pnpm monorepo 骨架**（`packages/domain|shared|config` + `server/` + `client/`）。
- [ ] **B-21 架构测试落地真实代码库**（dependency-cruiser 完整规则 + `*.arch.test.ts`），CI 独立步。
- [ ] **B-22 从 `prototype/` 迁 `packages/domain`**（lifecycle / visibility / streak / moderation + 测试）。
- [x] **B-20/B-22/B-23（部分）** monorepo 骨架 + 迁 `packages/domain` + ESLint/Prettier —— iteration 1 完成。
- [ ] **B-21 架构测试补全** — 依赖方向 / 无循环 / 无孤儿的规则已上；`eslint-plugin-boundaries` 的完整分层配置待补（现用 dependency-cruiser + no-restricted-imports）。
- [ ] **B-24b 生产 Postgres 切换** — 需要部署环境时：加 `drizzle-orm/postgres-js` 驱动分支 + `DATABASE_URL`，schema/仓储/迁移不动。PGlite 留作开发 / 测试 / 演示。
- [ ] **B-25 `packages/config`** — 共享 tsconfig / eslint 预设抽成包（现在直接放根目录）。
- [ ] **B-26 i18n 抽取** — client 现为字面中文；抽到 i18n 层（standards 要求"第一天"，为可读性 demo 阶段先字面）。
- [ ] **B-27 微信 H5 适配 + PWA** — JS-SDK 分享、`manifest.json`、Service Worker。
- [ ] **B-28 生产静态托管** — `@fastify/static` 服务 `client/dist` + SPA fallback，让单进程也能跑；或分开部署（ADR 0003 D12 推迟项）。B-28 单进程托管已在 iter 6 落地，剩分开部署方案待定。
- [ ] **B-29 移除 `prototype/`** — monorepo 已功能对齐；确认后删。
- [ ] **B-32 E2E 进 CI** — CI 用较新系统装 `playwright install chromium` + 去掉 `channel: 'chrome'`；`e2e/` 依赖单独缓存。

### 待澄清 / 需用户或法务

- [ ] **B-40 "精选展示"默认开启的合规性** — 法务确认，见调研 ADR-M。
- [ ] **B-41 数值待定** — hold 时长目标 / 上限、链接有效期默认值、字数上下限、范本最终清单。见 use-cases 开放问题。
- [ ] **B-42 资金托管模式选型 + 公司主体 / 资质办理启动** — P3 前，见调研领域一 ADR-A…ADR-G。
- [ ] **B-43 openspec change `add-p1-text-blessing` 评审** — 通过后才 `/opsx:apply`。
