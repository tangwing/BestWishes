# BACKLOG

> **待办事项 + 工作恢复点。** 会话或电脑重启后，从这里接着干。
> 已完成的事进 [CHANGELOG.md](CHANGELOG.md)；这里只留没做完的 + 恢复所需的上下文。
> 每轮对话：新增 / 更新任务，完成的挪进 CHANGELOG。状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 刚完成（下轮挪走）。

---

## 恢复点（先读这段）

- **阶段**：**P1 已完成并归档**（详见下方"P1 存档"），**P2 第一批已归档**。**三步走的第 1 步 `redesign-kindness-entry`（B-94）已全部实现完成**，且用户看过 demo 后又追加了四点优化（B-97~B-100，2026-09-19，全部已落地，详见 CHANGELOG）——祈福广场的祈福现在必须为他人而写（新增必填 `beneficiaryLabel`）、「传递善意」全量改名「传播善意」、祈福详情 / 发件箱加浏览与回复次数体感、移动端专项 UI 设计建议留到 B-96。`pnpm verify`（224 测试）/ `pnpm test:e2e`（17 个）/ `openspec validate --all --strict`（17 项）全绿，`docs/DEMO.md` 已补这四点变化的走查。**当前仍等用户审阅整个 `redesign-kindness-entry`**——同 P1/P2 的老规矩，审阅通过由用户自己拍板，通过前不自行动第 2 步（`add-shareable-blessing-card`）或扩大范围。
- **B-94 实现笔记（供归档前复核）**：
  - **范围调整（已跟用户确认，非擅自决定）**：实现中发现"回应祈福"当前只有**音频**一条路径（录音+验证码+提交，天然 ≥3 次交互），既装不进"≤2 次主动操作"的预算，录音 `Blob` 也没法像文字那样存进 `sessionStorage` 撑过登录跳转的往返。跟用户对齐后：`RespondToWishRequest.tsx`（音频回应页）维持登录前置不变；"访客可进页 / 登录延后到提交 / 内容不丢"这套机制只落在 `Compose.tsx`（文字：群发 + 回信）；e2e 的"内容不丢"与"两步路径"两条用例改用**群发文字**路径演示。首页仍然按 spec 展示一条真实祈福 + 最新回应摘录，只是"回应这条祈福"按钮走的是既有的登录前置录音页，不是新机制。
  - **顺带发现并收口的既有权限缺口**：`wish-request-service.detail()` 对所有 viewer 下发 `audioUrl`，但 `audio-scoring-service.readAudio()` 只放行作者/收件人——广场上第三方登录用户点播放必然 403。已改为"该祝福是某条 `published` 祈福的公开回应时，任何登录用户可放行"，P1 群发音频的权限不变，补了权限矩阵测试。
  - 新增 `wish_requests.anonymous` / `last_response_excerpt` 两列 + 一次性回填脚本（`pnpm --filter @bestwishes/server backfill:last-response-excerpt`，上线前对存量数据跑一次，见 design.md 迁移计划）。
  - 涉及文件较多，逐条改动看 [tasks.md](openspec/changes/redesign-kindness-entry/tasks.md) 的勾选说明比这里复述准确。
- **B-68 add-p2-wish-request-audio**：实现细节 + 过程中发现修复的问题（filler-word 误判、HMAC 分隔符冲突、`requestId` 表单冗余字段导致的 422、回应页缺 consent gate、以及一处真实安全缺口——`suspect` 内容曾能绕过人工复核直接进公开广场）全部记在 [tasks.md](openspec/changes/add-p2-wish-request-audio/tasks.md) 的勾选说明里，逐条读比这里复述准确。**未归档**——归档是用户审阅通过之后的动作，不预先做。
- **B-69（2026-09-08 用户 Safari 走查）**：`AudioRecorder` 只在 Chrome 上验证过，Safari 上录音结束报错、且录音拿不到导致"发送"按钮永久禁用。已修：`webkitAudioContext` 兜底 + 波形初始化失败降级不阻断录音；按 `MediaRecorder.isTypeSupported` 选容器格式（Safari 出 mp4）、回放路由按文件头嗅探 `Content-Type`；`start(250)` timeslice + 空录音明确报错。详见 tasks.md §8.6。`blessing-audio` delta spec 已同步。**Safari 真机复测待用户做**。
- **技术栈**（ADR 0003）：Web-first PWA + Node/TS（Fastify）+ PostgreSQL（Drizzle / PGlite）+ pnpm monorepo；音频新增 `@fastify/multipart` 依赖 + 本机文件落盘（生产换对象存储时同 PGlite→postgres-js 的"换驱动不换契约"模式）。
- **工作方式**：用户按点评提改动 → 记进本文件 → 持续完成。每轮结束自动 commit + push。
- **2026-09-08 用户 Demo 走查反馈（B-69~B-73）**：Safari 录音失败（B-69，两轮修复 + 加了可见诊断行，等 Safari 真机复测）；协议页硬编码跳转 bug（B-72，已修 + e2e 回归）；demo 数据持久化（B-73，`pnpm demo` 现在落盘 PGlite，重启不丢个人资料）；验证码校验确实实现了但校验的是客户端转写文本（B-70，P2 信任边界，无需改）；**B-71 导航改名/结构调整需要用户先回答 4 个歧义点**（见待办区），没动。
- **UAT 自动化**：用户问有没有框架能自动跑他手动做的走查——**有，就是 `e2e/`（Playwright + 真实系统 Chrome）**，`pnpm test:e2e` 跑，13 个用例覆盖 P1 群发 + P2 请求/录音/打分/审核全链路（录音用 `--use-fake-device-for-media-stream` 真的走 MediaRecorder）。本轮把用户手动发现的 B-72 也补成了回归用例。唯一盖不到的是 Safari（macOS 12 装不了 Playwright webkit）。
- **B-71 祈福广场重构（2026-09-09，spec + 代码都已完成）**：用户点评把"祝福请求"重塑为社区式「祈福广场」（Topic + `responseCount`/`lastResponseAt` 聚合统计、列表只摘要、详情才看回应、"我的祈福"= `?filter=mine`）+ 导航精简（8→6 项，删「回响」，「收件箱」→「我的福袋」/`/pouch`，「写祝福」→「传递善意」/`/give` 并入发件箱，路由 `/wish-requests*`→`/plaza*`）。回响用"务实删"（删页面/服务/纯函数模块 + 个人空间显示"你已传递 N 份善意"；`blessing-transition` 的 `countedInStreak`/`streakDelta` + `streak_days` 表保留为 dormant——见 B-74）。`/opsx:update` 同步了 spec（`wish-request` 重写 + `blessing-records`/`user-profile` MODIFIED + `blessing-streak` REMOVED），`/opsx:apply` 落了 §9 代码。`pnpm verify` 196 / `pnpm test:e2e` 13 全绿。详见 tasks.md §9。
- **2026-09-13 用户走查 §9 后的 5 点反馈（B-76~B-79 已修，见下方 P2 走查反馈一节）**：拒绝时"成功"文案自相矛盾且不给理由（B-76，真 bug，`myFeedback` 改判别式返回 + `OutboxItem` 加 `rejectionCategories`）、审核台空队列仍显示默认处理理由（B-77）、个人空间密度太低缺免责声明（B-78）、传递善意页送给谁该排到正文前 + 范本默认折叠（B-79）。`pnpm verify` 196 / `pnpm test:e2e` 13 全绿，`audio-scoring` delta spec 补场景。B-81（编辑重发/申诉入口，P1 归档时就有的老缺口）记待讨论，未做。
- **开发节奏原则（2026-09-13 起生效，B-82）**：用户定的通用原则——功能快速迭代期，复杂判定逻辑先用可切换的简单 mock 顶上（不删，留到后面阶段再切回），保证随时有可用 demo。第一个落地：内容审核新增 `AlwaysPassProvider` + `BW_MODERATION` 环境变量，`pnpm demo` 恒 `always_pass`，全局默认仍是 `rule_based`（不跟 `content-moderation` 已归档 spec 的"默认不放行"硬约束冲突）。**后续做新功能，复杂逻辑要先想一下是否也适用这个模式**（先上可插拔接口 + mock 实现，demo 脚本切换，真实逻辑晚点接）。
- **2026-09-13 第三轮反馈（B-83~B-87，全部已处理，见下方对应小节）**：年龄筛选滑块化（B-83，过程中用运行中的 demo 直接排障了一个"标签匹配却显示空列表"的疑似 bug，查明是既有 spec 行为——没填出生年的候选人会被任何非空年龄条件排除——被数字输入框的杂散值意外触发，滑块从根上让这个不再发生）；消息时间戳 + 回信链接原消息（B-84）；「我的善意」音频回应看不到播放器的真 bug（B-85，B-71 合并列表时漏了 `contentType`/`mediaUrl`）；顶栏显示用户名（B-86）；trace/用户行为分析系统记入 AGENTS.md §6 待讨论、不实现（B-87）。`pnpm verify` 198 / `pnpm test:e2e` 13 全绿。
- **2026-09-13 第五轮反馈（B-88~B-91，见下方对应小节）**：补充文字不再强制 + 录音下限 5→4 秒（B-88，顺带修了"不写字就被误判违规"的连带 bug）；祈福回应终于能回复了（B-89，真 bug——`/plaza/:id` 从来没提供回复入口，现在每条回应下能看到 + 发起往返对话，新增 `wish-request` spec Requirement）；富文本/图片回复记录待讨论不实现（B-90）；延迟送达导致福袋"过一会儿又点亮"说明是既定设计非 bug（B-91，**但用户后来纠正了这个理解，见 B-93**）。`pnpm verify` 200 / `pnpm test:e2e` 13 全绿。
- **2026-09-13 第六轮反馈（B-92/B-93，用户纠正 B-91 的理解后排查出的两个真 bug）**：排查过程中先在运行中的 demo 上用 curl 直接撞见一个**严重且无关的 bug**——发布带地理位置的祈福并命中候选人时 500（B-92，`matchAndNotify()` 在 `wishRequests.add()` 之前写外键，PGlite 真外键约束下必炸，内存仓储测试从没覆盖过）；然后用同样的 curl 直接验证链路确认"一次提交只投递一次，不存在重复"，锁定用户感受的真正根源是收件箱音频回应看不到播放器、只有裸文字（B-93，跟 B-85 同类疏漏，这次是收件箱端）。两个都已修 + 补回归测试。
- **2026-09-13 阶段性复盘 → 三个 change（B-94/B-95/B-96）**：用户叫停功能迭代做了一轮全面复盘（分析与结论见 PROMPT_LOG.md 对应条目）。结论是断点在「理念 → 动线」而非领域模型——首次善意要 9 步跨 4 页且全程没有一个具体的人；**下一步不做原生 App、不先建视频打分**，改为三步：压缩首次善意路径 → 造可分享产物 → PWA 手机形态，再用三个数（打开→首次善意转化率、收到→24h 回赠率、外链带新占比）验证情绪回路。三个 change 的规划 artifact 已全部写完并 `validate --strict` 通过，**等实现**（用户说了会另开会话做）。
- **2026-09-19 用户看过 B-94 demo 后追加四点优化（B-97~B-100，全部已处理，详见 CHANGELOG）**：「传递善意」改「传播善意」（B-97，广播感）；祈福广场的祈福改为必须为他人而写，新增必填 `beneficiaryLabel`，理念声明加进产品（B-98，判断合理，`concept.md` 首发切入点本就是"为他人/逝者祈福"）；祈福详情 / 发件箱加"被浏览 N 次 / 收到 N 条回信"体感数字（B-100，过程中发现并修正了自己刚写的一个设计缺陷——不能把计数挂在页面本身的 3 秒轮询上，否则数字会被刷高）；移动端专项 UI 设计建议留到 B-96 再做（B-99，未实现，纯建议）。
- **P2 已归档**：`add-p2-wish-request-audio` 经用户确认后 `/opsx:archive`——4 个新能力（`audio-scoring` / `blessing-audio` / `wish-request` / `wish-request-matching`）落进主 specs，5 个 Requirement 替换、2 个新增，`blessing-streak` 整个能力退役（主 spec 文件已删）。主 specs 现在是 12 个能力。
- **下一步**：① `redesign-kindness-entry`（B-94）**等用户审阅**，通过后 `/opsx:archive`，再按顺序实现 `add-shareable-blessing-card` → `add-mobile-shell-pwa`（顺序是硬的，见下方 B-94/B-95/B-96 的说明）。每个 change 做完尽快 `/opsx:archive`，别再让"已实现未归档"的中间态拖长（AGENTS.md §2 的教训）。② Safari 录音（B-69）仍等真机复测。③ B-81（申诉/编辑重发入口）、B-90（富文本/图片回复）要不要做、做成什么样，待讨论。`add-moderation-rbac` 仍"先放着"（B-65）。B-66 待单独设计讨论。B-87（trace/分析系统）是三步做完后量那三个数的前提，**需要先讨论出结论**。

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

## 三步路线（2026-09-13 复盘后定，等实现）

> 顺序是硬的：第 2 步的落地页音频播放器沿用第 1 步定下的三档权限；第 3 步的底部 tab 依赖第 1 步已把首页做成"一条真实祈福 + 就地回应"。跳着做会踩空。

- [x] **B-94 第 1 步：入口动线**（`redesign-kindness-entry`）— 把首次善意从 9 步压到 2 步。新增 `kindness-entry` 能力（首屏呈现真实善意、最短路径 ≤2 次主动操作、登录推迟到提交那一刻且内容不丢）；**撤销 B-71 的"广场列表 MUST NOT 含回应正文"**，改为列表必须展示最新一条回应摘录（论坛正确但情绪错误的决策，是本轮复盘的核心发现之一）；访客可读文字、音频需登录；祈福加匿名发布；受众预览从硬门槛降级为可选辅助 + 默认受众条件。**顺带收口一个既有真实缺口**：`detail()` 对所有人下发 `audioUrl`，但 `readAudio()` 只放行"作者或收件人"，第三方在广场点播放必然 403——权限模型改为"广场公开回应，任何登录用户可播放"。4 个 artifact 齐全，`validate --strict` 通过。**已实现**（范围调整见上方恢复点），等用户审阅后归档。
- [ ] **B-95 第 2 步：可分享产物 + 即时回报**（`add-shareable-blessing-card`）— 新增 `blessing-card`（祝福卡：确定性生成、隐私约束、作为落地页 og:image）与 `blessing-feedback`（**文字祝福的用心反馈**，兑现 vision "始终提供"的承诺——管线早就建好了却只接在音频上）；落地页补 og 元信息 + **音频播放器**（B-93 明确遗留的缺口，在这里还账）。**唯一的重量级技术决策是"卡片图片怎么生成"**，design.md D1 给了四个候选与取舍（选中：手写 SVG + 一个光栅化依赖 + 服务端捆中文字体），实现前必须先定。**微信 JS-SDK 不在范围内**：需 appId + 已备案域名（B-42 未办），写了无法验证；og 那层在微信链接预览里已能成立。
- [ ] **B-96 第 3 步：手机形态**（`add-mobile-shell-pwa`）— 底部 tab（广场 / 传递善意 / 我的福袋 / 个人空间，**首页并入广场 tab**，用户 2026-09-13 拍板）、390px 版面约束、PWA 可安装、Web Push。`notification` 的 Purpose 里"真实推送通道留到后续"的那个后续就是这里。**明确不做原生 / RN / 小程序**——多端方式仍是 AGENTS.md §6 未决项，要先有留存数据。审核台从主导航移除（只是不显眼，**不是**权限门禁，B-65 仍待评审）。iOS Web Push 需 16.4+ 且必须先装到主屏，真机验证只能人工做。

## P2 Demo 走查反馈（2026-09-08，用户逐点提）

- [x] **B-69 Safari 录音失败** — 见上方恢复点 + `add-p2-wish-request-audio/tasks.md` §8.6。已两轮修复 + 加可见诊断，等 Safari 真机复测。
- [ ] **B-70（问题，非 bug）验证码校验是真的实现了吗** — 是。`audio-scoring-service.submit` 里 `transcriptContainsPhrase(transcript, tokenCheck.phrase)` 检查转写文本是否包含挑战短语，不含 → `livenessPassed=false` → 转人工复核队列（不直接驳回）。但 P2 不接真实 ASR，`transcript` = 用户自己在"补充文字"框里敲的 `clientTranscript`（`RuleBasedAsrProvider` 原样返回），这个信任边界写在代码注释和 design.md 里。所以现在校验的是"用户声称自己说了验证码"，不是"音频里真的有验证码"——真实云 ASR 接入后（B 待办）才变成对音频本身的校验。**无需改代码**，除非要在 UI 上把这个边界对用户说清楚。
- [~] **B-71 祈福广场重构 + 导航精简** — **spec 已产出**（2026-09-09 `/opsx:update` 并入 `add-p2-wish-request-audio`：proposal + design §7-8 + `wish-request` delta 重写 + 新增 `blessing-records`/`user-profile` MODIFIED delta + `blessing-streak` REMOVED delta + tasks §9；`openspec validate --strict` 通过）。**等用户 review spec**，通过后 `/opsx:apply` 落代码。关键决策：方案 A（回应仍是 Blessing，`WishRequest` 加 `responseCount`/`lastResponseAt` 聚合字段，独立 `WishResponse` 推到 P3 悬赏明确后）；福袋保留祈福回应投递；回响整个删（`blessing-streak` REMOVED），累计"善意"数并入个人空间；路由 `/plaza` `/plaza/:id` `/plaza/:id/respond` `/give` `/pouch`。目标结构：
  - **祈福广场**（替代「祝福请求」）：列表显示所有人的祈福，**列表只给摘要 + 统计**（如"已收到 N 条回应"），回应/祝福内容**要点进详情页才能看**。「我的请求」降为广场内部的**筛选项**（不是独立页）。
  - **底层建模**：把「一条祈福」建成**独立实体**，所有回应是它的关联——**参考社区论坛成熟的 Topic + Reply 建模**（Topic 有回复数/最后回复时间等聚合统计，Reply 挂在 Topic 下）。当前是 `Blessing(scope='wish_response', requestId=…)` 挂靠，需要重新审视是否要独立的 Topic 聚合 / Reply 实体。可能需要 design.md 甚至 ADR。
  - **传递善意**（替代「写祝福」/`/compose`）：既能写新祝福（P1 群发），也能看**之前发出的**——把「发出的」/发件箱（`Records`/`Sent`）合并进来。
  - **我的福袋**（替代「收件箱」/`Inbox`）：纯改名。
  - **回响页（`Streak`）整个删掉**；想保留的累计数等放进「个人空间」。
  - spec 同步：触及 `wish-request` / `blessing-records` / `blessing-streak` 等能力。**注意**：`wish-request` 等 P2 能力还只活在未归档的 `add-p2-wish-request-audio` 的 delta 里（见恢复点）——这个 change 的基线依赖 P2 先归档，或在提案里说明基线假设。
- [x] **B-72 偶发：祝福请求点「回应」跳到写祝福页** — 根因不是偶发随机，是**未同意协议时**才触发：`RespondToWishRequest` / `PublishWishRequest` 未同意 → 跳 `/agreement`，而 `Agreement.tsx` 同意后**硬编码** `nav('/compose')`，不管来处。已同意过的会话不会触发，所以看着"偶发"。已修：`/agreement` 支持 `?returnTo=`（`safeReturnTo` 挡开放重定向），两个页面跳转时带上来处，同意后回到来处（默认仍 `/compose`）。加了 e2e 回归（wish-request.spec.ts #12：未同意用户点回应 → 协议页 → 同意后回到 `/respond`）。
- [x] **B-73 个人资料每次测试都要重输** — `demo` 脚本用默认 `BW_DB=memory`，重启即清空。已改 `demo` 为 `BW_DB=pglite BW_PGDATA=.pgdata` 落盘持久化（`.pgdata/` 已在 `.gitignore`），会话 cookie 存 userId + 30 天有效期，重启仍登录。新增 `pnpm demo:fresh` 干净重来。`docs/DEMO.md` 已更新。

## P2 Demo 走查反馈（2026-09-13，用户逐点提，B-71 落地后）—— 全部已修复

- [x] **B-76（真 bug）拒绝时的误导性"成功"文案 + 缺失拒绝原因** — 回应祈福被内容审核判 `violation` 后，`AudioFeedback.tsx` 标题恒显示"已发出这段祝福 ✔"，下面却同时显示"这条内容没有通过安全审核，不会送达，也没有反馈"——两句话互相矛盾。根因：`audio-scoring-service.myFeedback()` 把"还没打完分"和"命中 violation 永远不会有分"都返回同一个 `null`（实际上打分管线全同步，压根不存在真的"评估中"态，`null` 的歧义纯粹是接口设计问题），前端没法区分，也从没把审核大类暴露给作者。`Sent.tsx`（P1 文本祝福）同款问题——`rejected` 时标题仍是"已发送 ✓"。已修：`myFeedback` 改判别式返回 `{status:'pending'|'rejected'+categories|'scored'}`；`OutboxItem` 加 `rejectionCategories`；两个页面按真实结果显示文案 + 原因；顺带修了 `OutboxSection` 把祈福回应误标成"群发 N 人"（改标"回应祈福"）。`blessing-delivery` 主 spec 早写了"作者侧看到大类原因"，这次才真正接到前端；`audio-scoring`（未归档 delta）补场景。详见 tasks.md §10.1。**明确不做**：给 `auto_violation` 建审核工单（矛盾于现有设计：工单只服务于需要人工判断的场景）。**遗留**：spec 里"大类原因**与修改/申诉入口**"的后半句——让作者能就地编辑重发或发起申诉——仍未实现（`edit_resubmit` 触发器在 domain 类型里存在但从未被任何 service 调用），是 P1 归档时就有的老缺口，不在本轮修，见 B-81。
- [x] **B-77 审核台空队列仍显示默认"处理理由"输入框** — 已改成队列非空才渲染；顺带用新建的 `client/src/app/moderationCategories.ts`（镜像 domain 的 `categoryLabel`，client 不能依赖 domain）把队列项的审核大类代码换成中文。
- [x] **B-78 个人空间信息密度太低 + 缺免责声明** — 顶部加"这些信息我们不会验证真伪，但会影响别人筛选到你"；昵称/城市/性别/出生年从三个大卡片压缩进一个卡片的两行布局。
- [x] **B-79 传递善意页面重排** — 「送给谁」移到「场景/正文/范本」前面；「范本」默认折叠（链接按钮展开），不占开屏空间。按草稿推荐范本是用户提的未来方向，不在本轮做。
- [ ] **B-81（新，B-76 过程中发现的遗留）祝福被拒后没有"编辑重发/申诉"入口** — `blessing-delivery` 主 spec 的"自动判定违规"场景要求"作者侧看到大类原因**与修改/申诉入口**"；B-76 把"看到大类原因"这半句做了，"修改/申诉入口"从 P1 归档起就没实现过（`LifecycleTrigger` 里的 `edit_resubmit` 从未被调用）。现状：作者知道被拒了、也知道为什么，但只能去"传递善意"重新写一条全新的，没有"基于这条改一改再发"的路径。是否要做、做成什么样（原地编辑复用 slug，还是同 B-63 的"复制以供编辑"模式）需要先讨论，不预先设计。
- [x] **B-82 内容审核默认恒 pass，供 demo 节奏用** — 用户定了一条通用开发节奏原则：功能快速迭代期，复杂判定逻辑先用简单 mock 顶上（不删，留到后面阶段再切回），保证随时有可用 demo。第一个落地对象是内容审核——新增 `AlwaysPassProvider`（domain，恒 `pass`，不跑任何判定）+ `BW_MODERATION` 环境变量（`rule_based` 默认 / `always_pass`）。**只改了 `pnpm demo` 脚本的显式覆盖，没改全局默认值**——`content-moderation` 主 spec（已归档 P1）"审核服务不可用 MUST NOT 默认放行"是硬约束，悄悄把全局默认改成放行会跟这条 MUST 冲突，所以默认值仍是 `rule_based`（跟 e2e / 单测行为一致，不掉真实判定的测试覆盖）。`docs/DEMO.md` 补了这条 + "要看真实判定效果需要 `BW_MODERATION=rule_based pnpm demo`"的提示（不然会以为触发词场景是新 bug）。已记进持久化 memory（`mock-complexity-for-demo-pace`），后续功能要复用这个模式（先 mock，接口留在可插拔的 port 后面）时不用重新讨论一遍。

## P2 Demo 走查反馈第三轮（2026-09-13，用户又提 6 点）—— 全部已处理

- [x] **B-83（含一次真实排障）年龄范围筛选滑块化** — 用户："避免填数字，用进度条之类更友好的交互"。同一批还报了一个疑似 bug："筛选结果是空，实际是有的（标签养宠物，有个账号符合）"——**动手前先用运行中的 demo 直接排障**（stub-login 复用同一昵称能拿到同一账号，读了 `.pgdata` 里的真实画像数据，绕过 UI 直接调 `POST /api/audience/preview` 核对）：候选人画像 + 距离 + 标签在纯函数层完全匹配（直接调 API 复现出 `count:1`），但**只要 `ageMin`/`ageMax` 意外变成非 null（哪怕是 1）**，候选人因为没填出生年就被排除——这是 `user-profile` spec 早就写好的既有行为（"这些字段 MAY 留空；留空时不会被相应的受众条件命中"，`audience.test.ts` 也测过），不是逻辑 bug。真正的病根是 UI：原生 `<input type="number">` 的上下小箭头一点就能把"空"变成"0/1"而不易察觉，用户很可能就是这样意外带上了年龄条件。修：新增 `RangeSlider.tsx`（双滑块，推到两端 = 该方向不限，直接替代数字输入），从根上让这类"悄悄带了个杂散值"的情况不会发生。
- [x] **B-84 消息带时间戳 + 回信可跳回原消息** — 福袋 / 我的善意 / 祈福详情的每条消息补了时间戳（新 `formatTime.ts`，"9/13 14:05" 这种格式）。回信预览"回的是你那条：「...」"改成可点的链接，用原信的 `slug` 跳 `/p/:slug`（复用现成的公开落地页，不用新建"查看单条消息"的页面）；`inbox-service.ts` 的 `inReplyTo` 加 `slug` 字段。
- [x] **B-85（真 bug，B-84 排查时顺带发现）"我的善意"里的音频回应看不到播放器，只有转写文字** — B-71 把祈福的音频回应合并进统一的"我的善意"列表时，`OutboxItem`（`blessing-service.outbox()`）没带 `contentType` / `mediaUrl`，`OutboxSection.tsx` 只渲染 `bodyPreview`（音频祝福的 `body` 就是转写文字），完全没有 `<audio>` 元素——回应者在自己的"我的善意"里看不到、也放不了自己发出的录音（祈福详情页那边是有播放器的，"我的善意"这条路是漏网的）。已补齐两个字段 + 播放器渲染。
- [x] **B-86 顶栏右上角显示用户名** — `App.tsx` 导航栏加了昵称（`user.nickname`）。**用户点评：一开始塞进 `.nav` 里显示在菜单中间**，改成 `.topbar` 拆两行——`.topbarTop`（品牌名 + 用户名，两端对齐）在上，导航链接单独一行在下，用户名现在跟品牌名同一行、贴右边界。
- [ ] **B-87（记录，不实现）需要建立完善的 trace 系统，统计用户操作轨迹用于产品分析优化** — 用户明确是"未来计划里记一下"，不是本轮要做的事。这是一块独立的架构决策，已加进 AGENTS.md §6，动手前要跟其它未决问题一样先澄清：track 什么粒度的事件（页面浏览 / 具体操作如"点了预览收件人" / 停留时长）？自建（写进现有 PG 表 + 自己出报表）还是接第三方（如 PostHog/Umami 这类可自托管的，还是 Mixpanel 这类 SaaS）？要不要区分匿名访客 vs 登录用户？数据保留多久、要不要匿名化处理（尤其现在的用户已经在个人空间收集位置/年龄/性别，加行为轨迹会显著提高隐私敏感度）？跟 `docs/product/` 里还没定的商业化/合规问题（B-40/B-42）也有交叉，建议一起讨论。

## P2 Demo 走查反馈第五轮（2026-09-13，回应无法回复 + 补充文字/录音门槛）

- [x] **B-88 补充文字不再强制 + 录音下限 5→4 秒** — 用户："录音之后又要重新打一遍文字…先不要求文字必填。另外，录音的长度在4秒钟以上即可"。`RespondToWishRequest.tsx` 去掉了"必须填补充文字"这道门槛。**过程中发现并修了一个连带 bug**：`audio-scoring-service` 原来无论转写是否为空都会丢给 `ModerationProvider`，而规则实现对空字符串恒判"低有效内容"→ `violation`——文字一旦不强制，"不写字"就会被直接误判违规驳回，跟"取消强制"的初衷正好相反。改成没有转写文本时跳过 `ModerationProvider`、直接按"无法自动核验、转人工"处理（同"审核服务不可用"的保守处理原则），不会被误判"未通过"。`packages/domain` 的 `audioMinDurationSec` 默认值 5→4。**没做**：录音自动转文字（如 Web Speech API）——用户明确给了"如果不能就先 pending"的许可，考虑到跨浏览器可靠性差（Safari 支持有限）、e2e 假麦克风设备录不出真实语音没法自动化测试，且"取消强制"已经解决了主要的重复劳动感受，先不做，记 BACKLOG B-90 附近一起讨论。
- [x] **B-89（真 bug，新增"回应下的往返回复"能力）祈福广场回应收到后无法回复** — 用户："收到这个语音祝福后没有办法回复"，并指出"一个祈福确实像社区里的一个 topic，点进去之后要能够显示下面连续的回复"。排查：不是后端坏了（`scope=reply` 机制本身好用，直接调 API 验证过），是 `/plaza/:id`（B-71 后的主要交互入口）从来没做回复功能，只有"去福袋点回一段祝福"这条旧路多数人不会主动想到。做法：`BlessingRepository` 加 `listRepliesTo`；`wish-request-service.detail()` 对每条回应递归拼出往返回复链（深度封顶纯兜底）；`WishRequestDetail.tsx` 在每条回应下内联展示回复 + 回复输入框，复用现成的 `scope=reply` 提交，没有新开接口、没建新的评论系统。请求人和回应者都能发起，回复目标固定是"这条回应涉及的另一个人"。`wish-request` spec 新增"回应下的往返回复"Requirement。
- [ ] **B-90（记录，需讨论，用户在同一轮提出）回复要支持富文本 + 图片** — 用户："文字回复要成为富文本回复，可以回应图片"。这是新的产品面：图片存储（复用现在的本机落盘 `AudioStoragePort` 思路，还是要新的 port？）、图片内容审核（现有 `ModerationProvider` 只吃文字，图片审核是完全不同的能力，需要新选型）、富文本编辑器与渲染、审核台怎么展示待审图片。跟 B-89 的回复机制强相关但明显是更大的一块，需要先讨论范围（"富文本"具体到什么程度——加粗/表情，还是完整的编辑器？）再动手，不预先设计。
- [x] **B-91（说明，非 bug——但解释不完整，见 B-93）延迟送达导致"过了一会儿才收到、又点亮了福袋"** — 用户报告"和语音祝福一起的文字祝福过了一会儿才收到，又一次点亮了我的福袋"。核对代码：这是"发布即校验、延迟送达"的既定设计（P1/P2 一以贯之）——提交时内容安全检查已经同步跑完，但正式投递要等 hold 期（demo 里 `BW_HOLD_SECONDS=8`）+ 下一次扫描（每 3 秒一次）才触发，所以确实会有几秒到十几秒的延迟，届时新消息点亮福袋是预期行为，不是重复推送或计数错误的 bug。**用户后来纠正了这个解释**：他说的不是"过一会儿又收到一条"，而是"同一次回应（录音+补充文字）点亮了两次，第二次点开福袋只看到文字，感觉这段文字跟录音完全没绑在一起"——这指向另一个真问题，见 B-93。

## P2 Demo 走查反馈第六轮（2026-09-13，用户纠正 B-91 的理解）

- [x] **B-92（真 bug，严重）发布祈福 + 命中候选人推送 → 500** — 排查 B-91 纠正意见时，用真实 curl 直接打运行中的 demo（`pnpm demo` 用的 PGlite，真外键约束），发布一条有地理位置的祈福直接 500。查服务端日志：`wish-request-service.publish()` 原来先 `matchAndNotify()`（写 `notifications.request_id` 外键指回这条祈福）再 `wishRequests.add()`——PGlite 开着真实外键约束时，记录还没插入就先写引用直接 `23503` 报错，整条发布请求跟着失败。**内存仓储没有外键约束，`wish-request-flow.test.ts` 等一直跑绿，从没测出来**——只有走真 PG 语义的 `pg-repositories.test.ts` 才会炸，而这条流程之前在那个文件里完全没有测试覆盖。已修：`add()` 先落库，再 `matchAndNotify()` + `save()` 补上 `recipientCandidateIds`。新增 `pg-repositories.test.ts` 回归用例（`git stash` 验证过确实先失败后通过）。这个 bug 会在任何"发布的祈福有地理位置且附近有候选人"的真实场景下必现，属于用户实际测试条件（`pnpm demo`）会直接撞上的路径。
- [x] **B-93（真 bug）福袋里的音频回应只显示转写文字，看不到播放器、听不到录音** — 用真实 curl 直接验证了一遍完整链路（发布祈福 → 回应者提交录音+补充文字 → hold+扫描后送达请求人）：确认**一次提交只产生一条 Blessing / 一条收件箱记录 / 一条通知，不存在重复投递**。但收件箱（`Inbox.tsx`）点开这条记录只显示转写文字，没有任何播放器或"这是一段录音"的提示——跟 B-85 是同一类疏漏（B-85 修的是"我的善意"发件箱，这次是收件箱），根因是 `InboxView`/`InboxItem` 一直没有 `mediaUrl` 字段。这完全能解释用户"点开福袋只看到文字，感觉这段文字跟录音没绑在一起"的感受——不是"多了一次投递"，是"看起来像纯文字，看不出这是同一条录音的文字记录"。已修：`inbox-service.ts` 的 `InboxView` 加 `mediaUrl`（同 `b.media?.url ?? null` 的既有模式）；`Inbox.tsx` 音频类型加 `<audio controls>` 播放器 + "这段录音的文字记录："提示语，把文字和录音在视觉上绑在一起。`wish-request-flow.test.ts` 补了回归断言。**未做、记录延后**：`/p/:slug` 公开落地页（`PublicPage.tsx`）有同样的缺口——回复链接"回的是你那条"会跳转到这个页面，如果原始回应是录音，那里目前也只有文字。没有一起改是因为音频回放路由 `/api/blessings/:id/audio` 要求登录且是收发双方才能拉取，而公开页按设计是任何人免登录可看，这两者冲突需要先决定权限模型（比如给已发布的公开录音单独开一条免鉴权但仍按 blessing id 查的路由），不是照抄 B-85/B-93 的模式就能顺手带上的小改动，留给下一轮专门讨论。

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
- [ ] **B-74 清理回响 dormant 残留** — B-71「务实删」保留了 `blessing-transition.ts` 的 `countedInStreak` / `streakDelta`、`ports` 的 `StreakRepository`、`streak_days` 表 + 两套实现、`InMemoryStreakRepository`。它们已无任何消费方（`blessing-write` 不再写 `streak_days`）。彻底删要动 P1 状态机的返回类型 + `blessing-transition.test.ts` / `blessing-flow.test.ts` 的成套断言 + 一次去列迁移——单独一轮做，确认无回归。
- [ ] **B-75 P1 规划文档里的"回响 / 收件箱"措辞** — `docs/product/{use-cases,capabilities,concept,p1-acceptance-status}.md`、`docs/architecture/p1-architecture.md` 仍按旧命名。属历史规划文档，B-71 没动（避免 Runaway Refactor）。要么按新命名走查一遍，要么在文档头加一句"术语见 CHANGELOG / DEMO.md 的 B-71 更新"。

### 待澄清 / 需用户或法务

- [ ] **B-40 "精选展示"默认开启的合规性** — 法务确认，见调研 ADR-M。
- [ ] **B-41 数值待定** — hold 时长目标 / 上限、链接有效期默认值、字数上下限、范本最终清单。见 use-cases 开放问题。
- [ ] **B-42 资金托管模式选型 + 公司主体 / 资质办理启动** — P3 前，见调研领域一 ADR-A…ADR-G。
