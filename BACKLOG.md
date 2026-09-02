# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：P1「文本静心祝福」**实现中**。用户已批准开工（"就按这个走吧，开工"），按 `/loop` 自定步调迭代，直到初版 Demo 跑通。
- **iteration 1-2 完成**：monorepo 骨架 + 领域层迁移（78 测试）+ 配置模块（§1.6）+ 数据层 ports（`ports/repositories.ts` / `records.ts` / `ids.ts`）+ 内存实现（`infrastructure/memory/`，openid 幂等 / slug 唯一 / 工单排序，93 测试全绿）。`pnpm verify` 绿。
- **iteration 3（下一步）**：§5 的 application 层用例 —— 从 `submitBlessing`（发布即校验、延迟送达、把个人空间默认值合并进发送者信息、拦粘贴由前端主管）开始，逐个把用例编排出来，port 用内存替身测。然后 §5 的 HTTP 路由。范本 seed（§4.3）从 prototype 迁。
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

### 待澄清 / 需用户或法务

- [ ] **B-40 "精选展示"默认开启的合规性** — 法务确认，见调研 ADR-M。
- [ ] **B-41 数值待定** — hold 时长目标 / 上限、链接有效期默认值、字数上下限、范本最终清单。见 use-cases 开放问题。
- [ ] **B-42 资金托管模式选型 + 公司主体 / 资质办理启动** — P3 前，见调研领域一 ADR-A…ADR-G。
- [ ] **B-43 openspec change `add-p1-text-blessing` 评审** — 通过后才 `/opsx:apply`。
