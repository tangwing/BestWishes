# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：**P1 已完成并归档**（详见下方"P1 存档"）。**P2 第一批（`add-p2-wish-request-audio`：祝福请求 + 匹配 + 音频录制打分）已全部实现完成**，`pnpm verify`（201 测试）/ `pnpm test:e2e`（12 个）/ `openspec validate --strict` 全绿，`docs/DEMO.md` 已补 P2 走查。**当前等用户审阅**——用户明确说过"审阅通过"由用户自己拍板，不能自行判定后就去动 P3 或扩大范围，所以这里先停下。
- **B-68 add-p2-wish-request-audio**：实现细节 + 过程中发现修复的问题（filler-word 误判、HMAC 分隔符冲突、`requestId` 表单冗余字段导致的 422、回应页缺 consent gate、以及一处真实安全缺口——`suspect` 内容曾能绕过人工复核直接进公开广场）全部记在 [tasks.md](openspec/changes/add-p2-wish-request-audio/tasks.md) 的勾选说明里，逐条读比这里复述准确。**未归档**——归档是用户审阅通过之后的动作，不预先做。
- **技术栈**（ADR 0003）：Web-first PWA + Node/TS（Fastify）+ PostgreSQL（Drizzle / PGlite）+ pnpm monorepo；音频新增 `@fastify/multipart` 依赖 + 本机文件落盘（生产换对象存储时同 PGlite→postgres-js 的"换驱动不换契约"模式）。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。每轮结束自动 commit + push。
- **下一步（等用户审阅反馈，不要自行推进）**：审阅通过 → `/opsx:archive add-p2-wish-request-audio`，然后再谈 P3（视频形态、悬赏资金等）范围。审阅若提出改动，按改动内容判断走 BACKLOG 点状修复还是回到这个 change 里改。`add-moderation-rbac` 仍按用户要求"先放着"（B-65）。B-66（标签/状态拆分）待后续单独设计讨论。

<details>
<summary>P1 存档（点开查看）</summary>

- P1 **已按 [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md) 重定为「陌生人祝福 · 按条件群发」，整套实现完成，openspec change 已 apply + archive**。`pnpm demo` 起单进程走完整链路。`pnpm verify` 绿，**139 测试**（8 个 `app.inject` 端到端 + 5 个 PGlite 集成 + domain audience/moderation/lifecycle 等）。`pnpm test:e2e` 绿（**10 个真浏览器**，多上下文模拟发送者 / 收件人）。
- **模型一句话**：注册用户有画像（经纬度位置 / 性别 / 出生年 / 标签）→ 写文本祝福（`contentType` 给音视频留白）→ 选受众（距离 / 年龄 / 性别 / 标签）→ 预览命中人数 → 命中 ∈ [1, `maxAudienceSize`=10] 才可群发 → 收件人在**收件箱**收到 + **通知**（未读徽标）→ 只能**回一段祝福**，不能对话。公开链接 `/p/:slug` 降级为"传播用"。审核目标改为过滤无效 / 垃圾 / 违规。
- **代码**：`packages/domain`（+ `audience.ts` haversine 匹配）· `packages/shared` · `server/`（+ `audience-service` / `inbox-service` / `notification-service`；投递扇出在 `blessing-write.ts` 的 `transitionAndPersist` 里到 `published` 时触发，幂等 `deliveredAt`；数据层内存 + PGlite 两套同 ports，11 张表）· `client/`（+ Inbox 页 + 通知徽标；Profile / Compose 重做）· `arch/` · `e2e/`。
- **走查**：见 [docs/DEMO.md](docs/DEMO.md)。
- **实现计划**：已归档，见 [openspec/changes/archive/2026-09-06-add-p1-text-blessing/tasks.md](openspec/changes/archive/2026-09-06-add-p1-text-blessing/tasks.md)；当前权威行为描述在 [openspec/specs/](openspec/specs/)（10 个能力，随代码保持同步，见 AGENTS.md §2「spec 同步检查」）。
- **本机限制**：① 数据层用 **PGlite**（WASM Postgres，进程内，真 SQL）；生产换独立 PG = 换 `drizzle-orm/postgres-js` 驱动一层。② macOS 12 → E2E 用**系统 Chrome**（`channel: 'chrome'`）。
- **关键文档**：[ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md) · [docs/product/use-cases.md](docs/product/use-cases.md)（v1）· [docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md)（v1）· [docs/product/p1-acceptance-status.md](docs/product/p1-acceptance-status.md)。

</details>

---

## 待用户审阅

- [x] **B-68 P2 第一批：祝福请求 + 匹配 + 音频打分**（`add-p2-wish-request-audio`）— **全部 8 节完成**：领域层（`WishRequest` 状态机、音频信号打分纯函数、稿子覆盖率判定）、数据层（`wish_requests`/`audio_scores` 表 + 内存/PGlite 两套实现）、音频存储（本机落盘）、打分管线编排（转写→安全审核→完整度/专注度/真诚度→挑战式真人校验）、服务层 + HTTP 路由、前端（请求广场/发布页/录音组件+实时波形/多维反馈展示/我的请求）、e2e（真实系统 Chrome + fake-device 参数真的录音，不是预置文件模拟）、文档（`docs/DEMO.md` 补 P2 走查，两处规划期遗漏的 spec 缺口已回补）。核心技术决策见该 change 的 design.md：`WishRequest` 独立聚合、`Blessing.scope` 加 `wish_response`、打分管线全部可插拔且 P2 默认用不依赖真实云账号的规则实现（`RuleBasedAsrProvider`/`RuleBasedSincerityEvaluator`，采信客户端转写这个信任边界已写进代码注释）、真人校验用挑战式 HMAC token（不做声纹/深伪检测）、评分输出恒为多维标签而非单一分数。过程中发现并修了几个真 bug：犹豫词"这个/那个"误判、HMAC token 分隔符和 ISO 时间戳冲突、`requestId` 表单冗余字段导致真实客户端 422（测试当年被自己"贴心"的多余字段掩盖）、回应页缺 consent gate；以及一处**真实安全缺口**——`wish-request-service.publish()` 曾经只处理 violation/pass，命中拉客护栏词的 `suspect` 内容会直接绕过人工复核进入公开广场（未登录都能看，曝光面比 P1 群发收件箱更大），已修复为 `pending_review` 状态 + 复用统一人工复核队列（`ReportRecord` 仿照 `NotificationRecord` 先例做成多态）。`pnpm verify` 201 测试、`pnpm test:e2e` 12 个、`openspec validate --strict` 全绿。**等用户审阅，审阅通过后再 `/opsx:archive`**。

## 刚完成（下轮挪进 CHANGELOG）

- [x] **B-31 更新 p1-acceptance-status.md** — 对齐 monorepo（本轮又按新模型重写）。
- [x] **B-50 consent gate 修复** / **B-51 「坚持」→「回响」** / **B-52 送达页说清收件人** — 见 CHANGELOG。
- [x] **B-60 P1 模型重定为「陌生人群发」（ADR 0004）** — 全栈实现 + 全套测试重写 + 文档 + openspec 同步。详见 CHANGELOG / PROMPT_LOG。
- [x] **B-61 标签支持自定义** / **B-62 正文下限 15→5** / **B-63 撤回后误重投 bug（移除 republish，改复制编辑）** / **B-64 回信关联原祝福** — 见 CHANGELOG。
- [x] **B-67 回补 `add-p1-text-blessing` 的 spec 并归档** — B-62/63/64/61 四处改动此前只进了 BACKLOG/CHANGELOG，没人回头改 openspec delta；用 `/opsx:update` 回补 `blessing-authoring`（字数 5）/ `blessing-delivery`（去 republish、加回信关联）/ `blessing-records`（发件箱按钮文案）三个能力的 spec + 校正 tasks.md 里几处过时描述，`validate --strict` 通过后 `/opsx:archive`，10 个能力主 spec 现在活在 `openspec/specs/`。同时在 AGENTS.md §2 加了"spec 同步检查"这条规则，防止再次出现"代码改了、spec 没跟"。
- [x] **B-43 openspec change `add-p1-text-blessing` 评审** — 随 B-67 一并解决：已 apply + archive，不再是待办。

## 待办

### 界面实操验收发现（2026-09-03）

- [x] **B-50 新用户提交祝福走不通（consent gate 失效）** — 从导航「写祝福」直接进 Compose，没被引导去同意协议；提交打 403 `consent_required`，错误只在长表单最底一行小字（`.error`），像"没反应"。根因：Compose 用 `GET /api/agreement/current` 判有没有同意，但该接口永远 200。修：`AgreementView` 加 `alreadyConsented`，Compose 进页即判、未同意跳 `/agreement`；`submit` catch 到 `consent_required` 也跳。api-flow +1 断言、E2E +1「新用户进 /compose → 跳 /agreement」（已验证去掉修复即失败）。
- [x] **B-51 「坚持」改「回响」** — 页面名 + 导航标签 + 文案改为"送人玫瑰手有余香"的调性，累计数为主、"连续天数"降为一句轻描述。仅改 client 文案，domain `streak` 模块名不动。
- [x] **B-52 送达页说清收件人怎么看** — `Sent.tsx` 补："把链接发给 TA（微信 / 短信都行），对方点开就能看到，不用注册、不用登录。" P1 没有站内 user→user，收件人只是访客。

### P1 设计 / spec

- [ ] **B-04b 发心 / 送达文案打磨** — 引导框和送达页的连接感文案已就位，措辞还可以再走一遍（B-04 的框架已落地）。
- [ ] **B-05 定位自动获取城市** — 个人空间开定位授权 → 自动填城市。P1 占位；实现待定（浏览器 Geolocation + 逆地理编码，粒度到城市）。
- [ ] **B-06 复查"禁止粘贴"的取舍** — 无障碍（读屏 / 语音输入不受影响，辅助粘贴会）、正常用户改错想重贴一小段。可能退化为"拦大段 / 拦命中范本的粘贴"。B-03 已上简单版。
- [ ] **B-65 审核台权限管理（RBAC）** — 现在任何登录用户都能进审核台（`routes.ts` 里明确写着"demo：任何会话都能进；真实按角色鉴权"）。已按用户要求开新 openspec change `add-moderation-rbac`，proposal/design/specs/tasks 齐全、`validate --strict` 通过：核心方案是 `users` 表加 `role` 字段（`user`/`admin`），登录时按 `BW_ADMIN_NICKNAMES` 配置授予/收回管理员角色（stub 登录阶段的过渡方案，P2 真实登录落地后替换"角色怎么来"这一步即可），审核台两个接口加 `requireAdmin` 门禁，前端隐藏入口 + 无权限提示。等用户评审 → `/opsx:apply`。
- [ ] **B-66 标签 / 当前状态拆分** — 用户指出首页"送给正在熬夜的人"这类例子本质不是标签而是**当前状态**（伤心、熬夜……），和"打工人""养宠物"这类长期静态标签该分开。初步方向：新增 `currentStatuses` 字段（结构同 `tags`），带短时效自动过期（如 24–48 小时），避免"上周伤心"还在被匹配。开放问题：过期时长多少、由用户手动设置还是系统按行为推断——需要单独讨论想清楚再定 spec，不在标签自定义（B-61）这轮里做。

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
