# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：P1 **已按 [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md) 重定为「陌生人祝福 · 按条件群发」并整套实现完成**。`pnpm demo` 起单进程走完整链路。`pnpm verify` 绿，**137 测试**（8 个 `app.inject` 端到端 + 5 个 PGlite 集成 + domain audience/moderation/lifecycle 等）。`pnpm test:e2e` 绿（**9 个真浏览器**，多上下文模拟发送者 / 收件人）。openspec `validate --strict` 通过。
- **新模型一句话**：注册用户有画像（经纬度位置 / 性别 / 出生年 / 标签）→ 写文本祝福（`contentType` 给音视频留白）→ 选受众（距离 / 年龄 / 性别 / 标签）→ 预览命中人数 → 命中 ∈ [1, `maxAudienceSize`=10] 才可群发 → 收件人在**收件箱**收到 + **通知**（未读徽标）→ 只能**回一段祝福**，不能对话。公开链接 `/p/:slug` 降级为"传播用"。审核目标改为过滤无效 / 垃圾 / 违规。
- **代码**：`packages/domain`（+ `audience.ts` haversine 匹配）· `packages/shared` · `server/`（+ `audience-service` / `inbox-service` / `notification-service`；投递扇出在 `blessing-write.ts` 的 `transitionAndPersist` 里到 `published` 时触发，幂等 `deliveredAt`；数据层内存 + PGlite 两套同 ports，11 张表）· `client/`（+ Inbox 页 + 通知徽标；Profile / Compose 重做）· `arch/` · `e2e/`。
- **走查**：见 [docs/DEMO.md](docs/DEMO.md)（已重写，需两个账号：发送者 + 收件人）。
- **实现计划**：[openspec/changes/add-p1-text-blessing/tasks.md](openspec/changes/add-p1-text-blessing/tasks.md)（§0 记录了重定）。
- **本机限制**：① 数据层用 **PGlite**（WASM Postgres，进程内，真 SQL）；生产换独立 PG = 换 `drizzle-orm/postgres-js` 驱动一层。② macOS 12 → E2E 用**系统 Chrome**（`channel: 'chrome'`）。
- **技术栈**（ADR 0003）：Web-first PWA + Node/TS（Fastify）+ PostgreSQL（Drizzle / PGlite）+ pnpm monorepo。
- **关键文档**：[ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md) · [docs/product/use-cases.md](docs/product/use-cases.md)（v1）· [docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md)（v1）· [docs/product/p1-acceptance-status.md](docs/product/p1-acceptance-status.md) · [openspec/changes/add-p1-text-blessing/](openspec/changes/add-p1-text-blessing/)。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。每轮结束自动 commit + push。
- **下一步**：等用户验收重定后的 Demo（两个账号走群发 → 收件箱 → 回信）。之后：真实微信授权 / 审核 API 时机、逆地理编码、真实推送、`/opsx:archive` 归档、删 `prototype/`、i18n（B-26）、PWA（B-27）。

---

## 刚完成（下轮挪进 CHANGELOG）

- [x] **B-31 更新 p1-acceptance-status.md** — 对齐 monorepo（本轮又按新模型重写）。
- [x] **B-50 consent gate 修复** / **B-51 「坚持」→「回响」** / **B-52 送达页说清收件人** — 见 CHANGELOG。
- [x] **B-60 P1 模型重定为「陌生人群发」（ADR 0004）** — 全栈实现 + 全套测试重写 + 文档 + openspec 同步。详见 CHANGELOG / PROMPT_LOG。

## 待办

### 界面实操验收发现（2026-09-03）

- [x] **B-50 新用户提交祝福走不通（consent gate 失效）** — 从导航「写祝福」直接进 Compose，没被引导去同意协议；提交打 403 `consent_required`，错误只在长表单最底一行小字（`.error`），像"没反应"。根因：Compose 用 `GET /api/agreement/current` 判有没有同意，但该接口永远 200。修：`AgreementView` 加 `alreadyConsented`，Compose 进页即判、未同意跳 `/agreement`；`submit` catch 到 `consent_required` 也跳。api-flow +1 断言、E2E +1「新用户进 /compose → 跳 /agreement」（已验证去掉修复即失败）。
- [x] **B-51 「坚持」改「回响」** — 页面名 + 导航标签 + 文案改为"送人玫瑰手有余香"的调性，累计数为主、"连续天数"降为一句轻描述。仅改 client 文案，domain `streak` 模块名不动。
- [x] **B-52 送达页说清收件人怎么看** — `Sent.tsx` 补："把链接发给 TA（微信 / 短信都行），对方点开就能看到，不用注册、不用登录。" P1 没有站内 user→user，收件人只是访客。

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
