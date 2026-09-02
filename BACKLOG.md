# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：P1「文本静心祝福」——需求 / 用例 / 架构 / 技术栈 / 工程规范 / 走查原型 / 界面稿都已成文并入库。正在按用户点评快速迭代设计与 spec。第一轮点评（撰写页精简、范本不可复制、个人空间、收发记录、发心引导）已落地到 spec + 画布 + 原型（`npm run verify` 绿）；等用户第二轮评审。
- **尚未开始写生产代码**：`client/` `server/` `packages/` 要等 openspec change `add-p1-text-blessing` 评审通过后 `/opsx:apply`。
- **技术栈**（已定，ADR 0003）：Web-first PWA（React+TS+Vite / CSS Modules）+ Node+TS（Fastify）+ PostgreSQL（Drizzle）+ pnpm monorepo，领域逻辑在 `packages/domain`。
- **关键文档**：[docs/product/vision.md](docs/product/vision.md) · [docs/product/use-cases.md](docs/product/use-cases.md) · [docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md) · [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md) · [openspec/changes/add-p1-text-blessing/](openspec/changes/add-p1-text-blessing/) · 走查原型 [prototype/](prototype/)（`npm run verify`）· 界面画布见 PROMPT_LOG 最新条目的链接。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。条件允许时派多 Agent 并行。每轮结束自动 commit + push（`.claude/hooks/auto-commit-push.sh`）。
- **下一步**：和用户一起过第二轮设计稿（画布 v2 已发布，链接见 PROMPT_LOG 最新条目）。

---

## 进行中

（无）

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
- [ ] **B-23 ESLint（typescript-eslint strict-type-checked）+ Prettier + 注释语言 lint**。

### 待澄清 / 需用户或法务

- [ ] **B-40 "精选展示"默认开启的合规性** — 法务确认，见调研 ADR-M。
- [ ] **B-41 数值待定** — hold 时长目标 / 上限、链接有效期默认值、字数上下限、范本最终清单。见 use-cases 开放问题。
- [ ] **B-42 资金托管模式选型 + 公司主体 / 资质办理启动** — P3 前，见调研领域一 ADR-A…ADR-G。
- [ ] **B-43 openspec change `add-p1-text-blessing` 评审** — 通过后才 `/opsx:apply`。
