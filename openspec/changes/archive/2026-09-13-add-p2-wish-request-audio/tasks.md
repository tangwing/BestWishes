## 1. 领域层（`packages/domain`，纯函数先行）

- [x] 1.1 `BlessingScope` 加 `'wish_response'`；`Blessing` 加 `requestId: string | null`；类型检查通过（`pnpm --filter @bestwishes/domain typecheck`）
- [x] 1.2 新增 `WishRequest` 类型（`id`/`authorId`/`situationText`/`scriptText`/`state`/`createdAt`/`recipientCandidateIds`）+ 极简状态机（`published → withdrawn → deleted`，`published → deleted`），仿 `lifecycle.ts` 风格写纯函数 `applyWishRequestTrigger`（`wish-request-lifecycle.ts`），单测覆盖合法/非法转移（7 测试）
- [x] 1.3 音频信号打分规则层（`audio-signals.ts`，纯函数，不含任何网络调用）：停顿分布、语速稳定性、犹豫词密度，组合成"专注度"标签（高/中/低）+ 置信度；单测覆盖边界情况（12 测试）。修了一个真实的精度问题：犹豫词表里的"这个/那个"是中文常规指示代词（如"这个世界"），朴素子串匹配会大量误判——改成"只在紧跟停顿标记（逗号/省略号/句末）时才算犹豫词"，权重/阈值全部走 `FocusScoringConfig` 配置，不硬编码
- [x] 1.4 稿子对齐覆盖率的纯函数（`script-coverage.ts`）：有稿子按分句字符覆盖率判定完整/部分/明显不完整；无稿子复用现有 `isLowEffort`/`looksGarbled` 判"是否构成有效表达"，不做覆盖率评估。单测覆盖完整/漏读大段/无稿子/纯乱码（9 测试）
- [x] 1.5 `pnpm test:unit` 全绿（122 domain 测试，+28）

## 2. 共享层（`packages/shared`）

- [x] 2.1 新增 `submitWishRequestSchema`（situationText 必填、scriptText 可选 ≤2000 字）
- [x] 2.2 `submitBlessingSchema.scope` 加 `'wish_response'`，补 `requestId` 可选字段。**未加 zod 层面的 `.refine`**——沿用本仓库已有的一致做法（`scope=reply` 时 `replyToUserId` 必填也不是 zod refine，是 `blessing-service.ts` 里带错误码的业务校验）：`contentType=audio` 仅在 `wish_response` 场景放行，这条跨字段规则放在应用层（见 §6.4），zod 只管形状
- [x] 2.3 `pnpm --filter @bestwishes/shared typecheck` 通过

## 3. 数据层

- [x] 3.1 `wish_requests` 表；`blessings.request_id`（可空，FK `wish_requests`，`onDelete: set null`）；`audio_scores` 表（`blessingId` 主键即 FK，`completeness`/`focus`+置信度/`sincerity`+置信度/`personalization`/`livenessPassed`/`computedAt`）；`notifications.blessing_id` 改可空 + 新增 `notifications.request_id`（`wish_request_matched` 通知用，两者按 `kind` 恰好其一非空）
- [x] 3.2 `pnpm --filter @bestwishes/server db:generate` 生成 `0002_absent_valeria_richards.sql`；人工检查过，只含预期的新表/新列/FK，无意外改动
- [x] 3.3 `in-memory-repositories.ts` 新增 `InMemoryWishRequestRepository`、`InMemoryAudioScoreRepository`；`pg-repositories.ts` 同步实现两套 ports 契约一致；`pnpm test`（167 测试，含 5 个 PGlite 真 SQL 集成测试）全绿验证了迁移可用

## 4. 音频存储

- [x] 4.1 `AudioStoragePort`（`ports/audio-storage.ts`）+ `LocalAudioStorage`（本机落盘，`server/src/infrastructure/audio/local-audio-storage.ts`）
- [~] 4.2 依赖 `@fastify/multipart` 已装；上传路由本身在 §6.3 一起做（路由层 + 校验逻辑放一起更连贯，不拆两处改）

## 5. 打分管线编排

- [x] 5.1 `AsrProvider` 接口（`ports/asr.ts`）：`transcribe(audio, durationSec, hint?)`，`hint.clientTranscript` 是一个明确写在代码注释里的信任边界——P2 规则实现采信客户端提供的转写（如浏览器 Web Speech API 的实时识别结果），真实云 ASR 接入后会改成服务端自己转写、不再采信这个字段
- [x] 5.2 `SincerityEvaluator` 接口（`ports/sincerity-evaluator.ts`）：`evaluate(transcript, requestContext)` 输出真诚度/个性化标签 + 置信度
- [x] 5.3 `RuleBasedAsrProvider` + `RuleBasedSincerityEvaluator`（`infrastructure/audio/`）：前者按 `hint.clientTranscript` 把词时间戳按时长均匀铺开（近似估计，非真实对齐）；后者用有意义字符的集合重合度判个性化、按重合度+长度判真诚度。都有单测（7 测试）
- [x] 5.4 挑战式真人校验（`infrastructure/audio/liveness-challenge.ts`）：`issueChallenge`/`verifyChallengeToken` 用 HMAC 签名做无状态校验（不用额外建表存"发出去的挑战"），三位随机数字短语，`transcriptContainsPhrase` 检查转写是否包含。单测覆盖签发/校验/过期/错误密钥/格式错误（7 测试，含一个真 bug：拼接字段最初用 `:` 分隔，和 ISO 时间戳自带的冒号冲突导致解析错位，改用 `|`）
- [x] 5.5 `audio-scoring-service.ts` 编排完成。实际做法跟当初设想的"接入 blessing-service.submit"不一样——写的时候发现音频回应根本不该走 submit() 那条"先落 body 再同步查 moderation"的路径（音频没有 body，要先转写才有文本可审），所以 `audio-scoring-service` 自己组一条 `draftRecord`（`contentType='audio'`, `scope='wish_response'`）→ `transitionAndPersist(..., 'submit', ...)` 进 `verifying`（复用状态机）→ 转写（`AsrProvider`）→ `body`/`media.transcript` 一起写成转写文本（moderation-queue 展示 `b.body` 需要看到真实内容，不能留空）→ `moderation.check`（复用现成 `ModerationProvider`）。命中 `violation` 直接驳回、不打分；`suspect` 或 `pass` 都跑完整性/专注度/真诚度/真人校验并落一条 `audio_scores`（内容质量反馈和"安不安全"是两回事）；真人校验不通过时按 suspect 同一条路径转人工（建工单，不新开一套复核机制）；只有"moderation 过 + liveness 过"才设 `holdUntil`，交给现成的 `scans.publishReady()` 扫上去发布——完全复用文本流程已有的 hold 节奏，没有新造轮子。
- [~] 5.6 超时保守处理——**有意先不做**：当前 `RuleBasedAsrProvider`/`RuleBasedSincerityEvaluator` 都是同步内存计算，管线不可能真的"超时"，现在搭一套超时扫描机制无法被任何测试验证到，纯属为假设中的未来（真实云 ASR）预先设计（违反"不为假设中的未来需求做设计"）。等真的接云 API、有真实网络延迟时，在 `audio-scoring-service.submit` 外面包一层超时 + 复用 `scans.ts` 的定时扫描模式即可，接口已经预留了空间（`audioScoringTimeoutSeconds` 配置项已经在，只是还没人读它）。记入 BACKLOG。
- [x] 5.7 集成测试（`wish-request-flow.test.ts`，11 个）：发布 + 广场 + 按标签匹配通知、不匹配/太远的人仍能在广场看到、不能回应自己的请求、完整链路到打分到送达到回应者看反馈、时长超范围拒绝、命中违禁词驳回不打分、命中拉客护栏词转人工、真人校验未过转人工、验证 token 过期拒绝、撤回后不能再回应、撤回是终态不能重新发布

## 6. 服务端应用层 + 路由

- [x] 6.1 `wish-request-service.ts`：发布（含内容安全检查，命中 violation 拒绝发布）、撤回（终态）、删除、广场查询（`listPublished`）、回应列表查询（仅作者，`listByRequestId` 新增到 `BlessingRepository`，只展示已 `published` 的回应，不设数量上限）
- [x] 6.2 匹配逻辑就在 `wish-request-service.ts` 内部（`matchAndNotify`），没有单独拆 `wish-request-matching-service` 文件——复用 `audience-service.ts` 的 `resolve()`，构造一个 `AudienceFilter`（`radiusKm=audienceMaxRadiusKm`、`tags=request.tags`、性别/年龄不限）直接喂给现成的 haversine+标签匹配纯函数；请求人没设位置时 `resolve` 返回错误，这里当"零候选人"处理，不阻止发布
- [x] 6.3 HTTP 路由（`interface/http/routes.ts`）：`POST /api/wish-requests`、`GET /api/wish-requests`（广场，未登录可访问）、`GET /api/wish-requests/mine`、`GET /api/wish-requests/:id`、`POST /api/wish-requests/:id/withdraw`、`DELETE /api/wish-requests/:id`、`GET /api/wish-requests/:id/responses`（仅作者）、`GET /api/audio-challenge`（发一次性验证词）、`POST /api/wish-requests/:id/respond`（`multipart/form-data`，接 `@fastify/multipart`，`attachFieldsToBody:'keyValues'` 让字段直接是字符串、文件直接是 Buffer，不用手动拼 parts）、`GET /api/blessings/:id/audio`（回放，音频文件用 blessing id 本身当 key，不用另建"音频 id → blessing id"的映射；鉴权逻辑放进 `audioScoring.readAudio()`，路由层只是薄薄一层）、`GET /api/blessings/:id/audio-feedback`
- [x] ~~6.4~~ 已在 5.5 里说明：不改 `blessing-service.submit`，音频走独立的 `audio-scoring-service.submit`
- [x] 6.5 HTTP 层集成测试（`wish-request-http.test.ts`，3 个）：未登录能浏览广场但发布/回应要 401；完整链路走真实 multipart 编码（手写了一个 `test-multipart.ts` 构造 body，没为测试单独加 `form-data` 依赖）；不相关第三方拉音频文件 403。这一层测的是"路由有没有接对、鉴权有没有漏"，业务分支已经在 `wish-request-flow.test.ts` 覆盖过了，不重复测

## 7. 前端

- [x] 7.1 请求广场页（`WishRequests.tsx`）：列表（暂不分页，跟 P1 outbox/inbox 一样先返回全量，demo 规模够用），未登录可浏览，点击响应引导登录
- [x] 7.2 发布请求页（`PublishWishRequest.tsx`）：处境描述 + 可选稿子 + 标签（复用 Compose 页同款自定义标签输入），静心引导风格跟 Compose 一致
- [x] 7.3 录音组件（`components/AudioRecorder.tsx`）：`MediaRecorder` 录制 + `AnalyserNode` 实时波形渲染（canvas）+ 计时 + 到达上限自动停止 + 重录。**转写不接真实语音识别**（design.md 早就定的取舍）——录音人自己在文本框里补充说了什么，这段文字就是打分管线的 `clientTranscript`
- [x] 7.4 回应者查看自己的多维反馈（`AudioFeedback.tsx`，轮询直到有结果，标签形式，不展示单一分数）
- [x] 7.5 请求人查看某条请求的回应列表页（`WishRequestResponses.tsx`，不展示评分细节，只有正文/音频）；另加 `WishRequestDetail.tsx`（单条请求详情，区分作者/非作者视角）和 `MyWishRequests.tsx`（我发布的请求列表 + 撤回）
- [x] 7.6 导航加"祝福请求"（任何人可见）+ "我的请求"（登录后可见）两个入口
- [x] 7.7 `pnpm --filter @bestwishes/client typecheck` 通过；**没有用无头模拟音频走查，是用真实系统 Chrome + `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` 启动参数跑通了完整浏览器流程**（发布请求 → 广场 → 录音页看到波形 → 真的录 6 秒 → 提交 → 反馈页显示多维标签），比预想的更接近真实使用路径。过程中揪出两个真 bug（不是理论风险，是这次手动走查实际触发的）：
  1. HTTP 路由的 `wishResponseFieldsSchema` 把 `requestId` 也定义成表单必填字段，但它其实来自 URL 参数——真实浏览器客户端理所当然不会在表单里重复带这个字段，一直 422。之前的 `wish-request-http.test.ts` 没测出来，是因为手写的测试数据"贴心"地把 `requestId` 也塞进了表单，掩盖了这个校验冗余。已修：去掉这个字段，测试也同步改成不发它，跟真实客户端行为一致。
  2. `RespondToWishRequest.tsx` 完全没做 `Compose.tsx` 早就有的"进页面查有没有同意协议 / 提交时接住 `consent_required` 跳转"这套逻辑——新用户直接点"录一段祝福回应"会走到提交那一步才发现自己没同意过协议，报错却没引导。两处都补上了，跟 Compose 页保持一致的把关方式。

## 8. 端到端与收尾

- [x] 8.1 e2e（`e2e/tests/wish-request.spec.ts`，2 个）：**没有用预置音频文件模拟**——`playwright.config.ts` 的 chrome 项目加了 `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` 启动参数 + `permissions: ['microphone']`，真的走 `MediaRecorder` 录 6 秒假音频，比原计划更接近真实浏览器路径。覆盖"发布请求（附稿子）→ 另一账号在广场看到 → 进回应页看到波形和验证码 → 真的录音 → 提交 → 多维反馈页 → 请求人在回应列表看到 + 能播放"，以及"撤回后广场看不到、我的请求页显示已撤回"。副作用：给 chrome 项目加 `permissions` 数组后，`author-flow.spec.ts` 原有的剪贴板测试因为不再"隐式允许"而 403——加了 `clipboard-write` 到同一个数组里补上。

  **这一步的过程本身就是最有价值的验证**：写这两个 e2e 测试时，先后挖出三个东西：
  1. （已在 §7.7 记录）HTTP 路由 `requestId` 重复校验的 422。
  2. （已在 §7.7 记录）回应页缺consent gate 的 403。
  3. **一个真正的安全审核缺口**：`wish-request-service.publish()` 从一开始就只处理了 `violation`（拒绝）和 `pass`（直接发布），完全没处理 `suspect`——命中拉客护栏词的处境描述会直接进公开广场（未登录都能看，比群发收件箱曝光面更大），不会进人工复核队列。这不是 e2e 测试断言直接抓到的（测试脚本本身没有专门造一条 suspect 内容去验证），而是在给 e2e 测试的第二个用例排查"广场文本重复导致断言失败"时，回头检查 `publish()` 全部代码路径才发现的。修法：给 `WishRequestState` 加 `pending_review`（`packages/domain`）、`ReportRecord` 仿照 `NotificationRecord` 的先例改成对 `blessingId`/`requestId` 二选一多态、`moderation-queue-service` 分支处理两种工单来源（`QueueItem` 加 `wishRequest` 字段，`resolve()` 按 `requestId` 是否存在分流）、`Moderation.tsx` 同步渲染两种预览。加了 4 个新集成测试（命中违禁词拒绝发布、命中护栏词进人工队列且不公开不推送、人工通过后才公开+触发匹配、人工驳回直接终态）到 `wish-request-flow.test.ts`，`wish-request-lifecycle.test.ts` 补了 3 个新状态转移测试。新迁移 `0004_magical_devos.sql`。
- [x] 8.2 `pnpm verify` 全绿（201 测试，+6：3 个新 lifecycle + 4 个新 suspect 集成测试 - 1 因为其它调整）；`pnpm test:e2e` 全绿（12 个，+2）
- [x] 8.3 `docs/DEMO.md` 重写标题/模型一句话覆盖 P1+P2，新增「P2 祝福请求 + 音频回应」完整走查表格，环境变量 / "这版没有的"两节同步更新
- [x] 8.4 `openspec validate add-p2-wish-request-audio --strict` 通过。顺带回补了两处规划期漏掉、实现中才发现的 spec 缺口（不是事后补充式的"让 spec 看起来完整"，是真实的规范空白）：`wish-request` 的「撰写祝福请求」一直没提到 `tags` 输入（但 `wish-request-matching` 的 spec 从一开始就假设了它存在）；`content-moderation` 的「统一人工复核队列」原文写死"目标祝福"，没考虑过队列的目标可能是一条祝福请求——这正是 §8.1 那个真 bug 在 spec 层面的对应缺口。都已经在 `wish-request/spec.md` 补场景、新增 `content-moderation/spec.md` 的 MODIFIED delta，`proposal.md` 的 Modified Capabilities 也加了这一条。
- [x] 8.5 BACKLOG.md / CHANGELOG.md / PROMPT_LOG.md 已更新（本次提交）——`add-p2-wish-request-audio` 全部 8 节完成，等用户审阅；审阅通过后再走 `/opsx:archive`（本变更本身未在这轮里归档，归档是审阅之后的动作，不预先做）
- [x] 8.6 用户 Safari 走查发现录音失败（B-69）：`AudioRecorder` 当初只在 Chrome（e2e 假设备）上走查过，几处硬编码在 Safari 上崩：① `new window.AudioContext()` 老 Safari 只有 `webkitAudioContext`，且这一步是波形用的、失败不该阻断录音——现在 `getAudioContextCtor()` 兜底 `webkitAudioContext`，整个波形初始化包在独立 try 里，失败就降级为无波形；② `new MediaRecorder(stream)` 不传 mimeType 时 Safari 录成 `audio/mp4`，但代码把 Blob 硬贴成 `audio/webm`、回放路由也硬编码 `Content-Type: audio/webm`——现在 `pickMimeType()` 按 `isTypeSupported` 选格式、Blob 用 `recorder.mimeType`、回放路由 `sniffAudioContentType()` 按文件头（EBML / ftyp / OggS）判类型；③ `recorder.start()` 不传 timeslice，Safari 有 stop() 丢最后一段数据的历史问题——改 `start(250)`，并在 `onstop` 里判 `blob.size === 0` 给明确报错而不是把坏录音交上去（坏录音 → 外层"发送"按钮因 `recorded` 为 null 永远点不动，正是用户报的第二个现象）；④ 无 `MediaRecorder` 的浏览器给明确提示。新增 `audio-content-type.test.ts`（4 个，嗅探器纯函数）；`blessing-audio` delta spec 补「Safari 录音可用」「波形初始化失败不阻断录音」「浏览器不支持录音」「回放按实际格式返回类型」四个场景 + 两处 Requirement 正文。`pnpm verify` 205 测试全绿、`pnpm test:e2e` 12 个全绿。**Safari 真机验证仍需用户在 Safari 上复测**（本机 e2e 只有系统 Chrome，macOS 12 装不了 Playwright webkit）。第二轮修复 + 加可见诊断行、`RespondToWishRequest` 禁用按钮下方列"还差什么"、`/agreement` returnTo 修复（B-72）、`pnpm demo` 落盘持久化（B-73）——见 BACKLOG。

## 9. 祈福广场重构 + 导航精简（2026-09-09 用户点评并入，见 design.md §7-8）

> 前八节是"待用户审阅"的既有实现；这一节是审阅期间用户提的重构，规模较大，走 `/opsx:update` 并入本变更的 spec，用户 review 通过后再 `/opsx:apply`。

- [x] 9.1 领域层：`WishRequest` 加 `responseCount` / `lastResponseAt`；删 `packages/domain/src/streak.ts` + `streak.test.ts`（回响纯函数模块 + 9 个测试）。`blessing-transition.ts` 的 `countedInStreak` / `streakDelta` 与 `streak_days` 表**保留为 dormant**——用户选"务实删"：它们和 P1 状态机及其成套测试耦合，硬拆是 Runaway Refactor，日后单独清理（BACKLOG 记一笔）。
- [x] 9.2 数据层：`wish_requests` 加 `response_count`（int not null default 0）/ `last_response_at`（timestamptz null）；迁移 `0005_past_revanche.sql`（只两条 ADD COLUMN，人工检查过）；pg / 内存仓储 mapper 同步。对账断言写进 §9.5 的集成测试。
- [x] 9.3 服务端：聚合计数维护点收敛到 `blessing-write.ts` 的 `transitionAndPersist`（`maintainWishRequestCounter`：`wish_response` 回应进/出 `published` 时 ±1，`lastResponseAt` 单调前移）——所有 publish/withdraw/takedown/expire 路径都过这里。`wish-request-service` 重写：`plaza(viewer, 'all'|'mine')` 返回 `WishRequestSummary[]`（摘要 + 统计，`situationExcerpt` 截 80 字，绝不含回应内容）；`detail(id, viewer)` 返回 `WishRequestDetail`（处境全文 + 稿子 + `published` 回应，无评分细节；未公开的只有作者能看）；删 `getById` / `myRequests` / `responses` 三个旧方法。路由 `/api/plaza[?filter=]`、`/api/plaza/:id`、`/api/plaza/:id/{respond,withdraw}`、`DELETE /api/plaza/:id`；删 `/api/wish-requests*`、`/api/streak/me`。`profile-service.view` 加 `kindnessCount`（`listByAuthor` 里数 `published` + `expired`）。删 `streak-service.ts`、`application/index` 去 `streak`。
- [x] 9.4 前端：`WishRequests.tsx` → 祈福广场（摘要卡片 + "已收到 N 条回应 · 最后活跃"，`?filter=mine` 用 `useSearchParams` 切换，mine 视图含 pending_review/withdrawn + 撤回按钮）；`WishRequestDetail.tsx` 重写为 `/plaza/:id` 详情页（处境 + 稿子 + 标签 + 回应列表音频/转写 + 轮询 + 作者撤回）；删 `WishRequestResponses.tsx` / `MyWishRequests.tsx` / `Records.tsx` / `Streak.tsx`。新组件 `components/OutboxSection.tsx`（原发件箱列表），`Compose.tsx` 底部渲染它（`!isReply` 时）→ "传递善意"页；h1 改「传递善意」。`Compose` 加 `location.key` 副作用处理"复制以供编辑"（同 `/give` 路由不重挂的坑）。`Inbox.tsx` h1 → 「我的福袋」。`Profile.tsx` 去 streak 入口，加"你已传递 N 份善意"。`Home.tsx` / `Sent.tsx` / `AudioFeedback.tsx` / `Agreement.tsx`（默认 returnTo）/ `PublishWishRequest.tsx` 路由与文案跟新。`App.tsx` 导航 8→6（首页 · 祈福广场 · 传递善意 · 我的福袋 · 个人空间 · 审核台）。`main.tsx` 路由：`/plaza`、`/plaza/new`、`/plaza/:id`、`/plaza/:id/respond`、`/give`、`/pouch`；`/sent/:id` 保留原样（不是导航项，少动）；删 `/wish-requests*` `/compose` `/records` `/inbox` `/streak`，不做旧路径重定向（内测期直接换）。client `api` 层同步。
- [x] 9.5 测试：`wish-request-flow.test.ts` +3（广场列表 `JSON.stringify(item)` 不含 `fake-audio` / 无 `responses` `situationText` 键；撤回后 `responseCount` 回落且 == `COUNT(published)` 对账；"我的祈福"筛选含 pending_review、默认广场不含）；已有用例的 `plaza()` / `responses()` 调用改新签名（`plazaIds` helper）。`blessing-flow.test.ts` / `pg-repositories.test.ts` 的 `streak.view().total` 断言迁移到 `profile.view().kindnessCount`；删 `streak.test.ts`。HTTP 测试改 `/api/plaza*` 路由、`server.test.ts` 401 探针换 `/api/profile/me`。e2e 全量路由/文案跟新（`support.ts` `agree()` 落 `/give`；`author-flow` / `wish-request` / `moderation` 改路由；协议页跳转断言用 `**/agreement**` 容忍 `?returnTo=`）。`pnpm verify` 196 测试、`pnpm test:e2e` 13 个全绿。
- [x] 9.6 文档：`docs/DEMO.md` 标题 / 模型一句话 / 导航说明 / P1+P2 走查表全部按新命名重写。`docs/product/*` / `docs/architecture/*` 里的"回响 / 收件箱"是 P1 规划期描述，属历史文档，不在这次动（避免 Runaway Refactor）；BACKLOG 记一笔留作后续清理。
- [x] 9.7 spec 已在 `/opsx:update` 同步：`wish-request` delta 重写、新增 `blessing-records` / `user-profile` MODIFIED delta、`blessing-streak` REMOVED delta。`openspec validate --strict` 通过。
- [x] 9.8 `pnpm verify`（196）/ `pnpm test:e2e`（13）全绿；BACKLOG / CHANGELOG / PROMPT_LOG 更新。**等用户审阅**（含前八节 + 本节），审阅通过后 `/opsx:archive`。

## 10. 用户审阅期间发现的问题（2026-09-13，逐点提）

- [x] 10.1（B-76，真 bug，触及 `audio-scoring` spec）拒绝时的误导性"成功"文案 + 缺失拒绝原因：`audio-scoring-service.myFeedback()` 把"还没打完分"和"命中 violation 永远不会有分"都返回同一个 `null`——但打分管线全程同步（见 5.5 的既有说明），实际上只可能是"已驳回"，不存在真的"评估中"态；`null` 的歧义纯粹是接口设计问题。改判别式返回 `{status:'pending'|'rejected'|'scored', ...}`，`rejected` 分支带 `categories`。`AudioFeedback.tsx` / `Sent.tsx`（P1 文本祝福同款问题——标题恒"已发送 ✓"，即便 state 已是 `rejected`）按真实结果显示对应文案，不再同屏出现"成功"和"没通过"两句互相矛盾的话。`OutboxItem` 加 `rejectionCategories`，`OutboxSection.tsx` 内联展示原因；顺带修了 `OutboxSection` 把 `wish_response` 回应误标成"群发 N 人"的问题（改标"回应祈福"）。`blessing-delivery` 主 spec 早就写了"作者侧看到大类原因"这个场景，这次才真正把这部分接到前端——"修改/申诉入口"那半句仍未实现，记 BACKLOG 单独跟进。`audio-scoring` delta spec 补充这条区分要求。测试：`wish-request-flow.test.ts` 改「转写命中违禁词」用例断言新判别式；`blessing-flow.test.ts` 新增 `outbox().rejectionCategories` 断言。**明确不做**：给 `auto_violation` 建审核工单——违反现有设计（工单只服务于需要人工判断的场景）。
- [x] 10.2（B-77，纯 UI）审核台空队列时仍显示默认"处理理由"输入框——改成队列非空才渲染；顺带用已有的 `categoryLabel`（客户端侧新建 `moderationCategories.ts` 镜像，架构边界不让 client 依赖 domain）把队列项的审核大类从原始英文代码换成中文。
- [x] 10.3（B-78，纯 UI）个人空间信息密度太低 + 缺免责声明：顶部加"这些信息我们不会验证真伪，但会影响别人筛选到你"；昵称/城市/性别/出生年从三个大卡片压缩进一个卡片的两行 row 布局。
- [x] 10.4（B-79，纯 UI）传递善意页面重排：「送给谁」移到「场景/正文/范本」前面；「范本」默认折叠（一个链接按钮展开），不再占开屏空间。

全部改动 `pnpm verify` 196 测试、`pnpm test:e2e` 13 个全绿，`openspec validate --strict` 通过。

## 11. 用户走查第四轮：回应无法回复 + 补充文字不再强制（2026-09-13）

- [x] 11.1（B-88，触及 `audio-scoring`/`blessing-audio` spec）补充文字不再强制，录音下限 5→4 秒：`RespondToWishRequest.tsx` 去掉"发出这段祝福"按钮里 `!transcript.trim()` 这个门槛，改成提示"不写也能发，只是没法自动确认验证词，会转人工看一眼"。**发现一个连带问题并修了**：`audio-scoring-service` 原来直接把（可能是空的）转写文本丢给 `ModerationProvider`，而 `RuleBasedProvider` 的"低有效内容"判定对空字符串恒判 `violation`——文字一旦不强制，"不写字"就会被直接误判违规驳回，跟"取消强制"的初衷正好相反。改成没有转写文本时不调用 `ModerationProvider`，直接按"无法自动核验、转人工"处理（同"审核服务不可用"的保守处理原则）。同步把 `packages/domain/src/config.ts` 的 `audioMinDurationSec` 默认值从 5 改成 4。**没做**：录音自动转文字（Web Speech API 之类）——用户明确说了"如果不能就先 pending"，鉴于跨浏览器可靠性差（Safari 支持有限、e2e 假设备录不出真实语音没法测）且"取消强制"已经把主要摩擦点解决了，先不做，记 BACKLOG 待后续设计讨论。
- [x] 11.2（B-89，真 bug + 新 Requirement，触及 `wish-request` spec）祈福详情页原来完全没有"回复"入口——用户反馈"收到语音祝福后没法回复"，根因不是后端坏了（`scope=reply` 机制本身好用，直接调 API 验证过），是 `/plaza/:id`（B-71 后的主要交互面）从来没提供回复功能，只有旧的"去福袋点回一段祝福"这条路（多数用户不会主动想到）。做法：`BlessingRepository` 加 `listRepliesTo(blessingId)`；`wish-request-service.detail()` 对每条回应递归拼出它下面的往返回复链（`collectReplyChain`，深度封顶 20，纯粹兜底用，正常是 DAG 不会成环）；`WishRequestDetail.tsx` 在每条回应下内联渲染回复列表 + 一个回复输入框（复用现成的 `POST /api/blessings` `scope=reply` 提交，不新开接口）。回复目标固定是"这条回应涉及的另一个人"（请求人 ↔ 回应者），取当前对话链最后一条消息的 id 当 `replyToBlessingId`。`wish-request` spec 新增"回应下的往返回复"Requirement。**没做**：富文本 / 图片回复——用户在同一轮里提了，但这是新的产品面（图片存储、审核、渲染），记 BACKLOG 待讨论，不预先设计。

全部改动 `pnpm verify` 200 测试、`pnpm test:e2e` 13 个全绿，`openspec validate --strict` 通过。

## 12. 用户纠正 B-91 的理解后排查出的两个真 bug（2026-09-13）

- [x] 12.1（B-92，真 bug，严重，触及 `wish-request` spec 隐含前提）发布祈福 + 命中候选人推送 → PGlite 下 500：排查 B-91 纠正意见时，直接用 curl 打运行中的 `pnpm demo`（真实外键约束的 PGlite），发布一条带地理位置的祈福直接 500。查服务端日志确认是 PG `23503` 外键违规：`wish-request-service.publish()` 原来先调 `matchAndNotify()`（写 `notifications.request_id` 外键指回这条待发布的祈福）再 `wishRequests.add()`——记录还没落库，外键就先写引用，PGlite 开着真实约束时直接报错，整条发布请求跟着失败。**内存仓储没有外键约束，`wish-request-flow.test.ts` 等主力测试从没测出来**，只有走真 PG 语义的 `pg-repositories.test.ts` 才会炸，而这条"发布 + 匹配候选人"的路径此前在那个文件里完全没有覆盖。已修：`add()` 先落库，再 `matchAndNotify()` 拿到候选人列表后 `save()` 回写 `recipientCandidateIds`。新增 `pg-repositories.test.ts` 回归用例，`git stash` 验证过：去掉修复确实复现同一个 `23503` 报错，加回后通过。这个 bug 会在任何"祈福作者设了位置、附近有候选人"的真实场景下 100% 必现，属于用户实际使用条件（`pnpm demo` 用 PGlite）会直接撞上的路径，跟用户报的原始问题无关，是排查过程中顺手挖出来的。
- [x] 12.2（B-93，真 bug，触及 `wish-request` spec 的"回应投递到福袋"场景）福袋里的音频回应看不到播放器、只有转写文字：用真实 curl 完整走了一遍链路（发布祈福 → 回应者提交录音 + 补充文字 → hold + 扫描后送达请求人），反复轮询请求人的 `/api/inbox` 和 `/api/notifications`，确认**一次提交只产生一条 Blessing / 一条收件箱记录 / 一条通知，绝不存在重复投递**——这排除了"真的点亮两次"的可能。但收件箱页面（`Inbox.tsx`）点开这条记录只显示转写文字，没有任何播放器或"这是一段录音"的视觉提示，根因是 `InboxView`（`inbox-service.ts`）/`InboxItem`（client）从一开始就没有 `mediaUrl` 字段——跟 B-85 是同一类疏漏（B-85 修的是"我的善意"发件箱，这次是收件箱端，两处各自维护自己的视图接口，没有共享导致同一个遗漏出现了两次）。这完全能解释用户"点开福袋只看到文字，感觉这段文字跟录音没绑在一起"的感受：不是多投递了一次，是投递的这一条在 UI 上把音频和文字的关联性丢掉了，看起来就像一条毫不相关的纯文字善意。已修：`InboxView` 加 `mediaUrl: string | null`（`b.media?.url ?? null`，同 `OutboxItem` 既有模式）；`InboxItem`（client）同步；`Inbox.tsx` 音频类型的记录加 `<audio controls>` 播放器 + "这段录音的文字记录："提示语，把文字和录音在视觉上绑定起来。`wish-request-flow.test.ts` 的"完整链路"用例补充断言 `inbox[0].contentType==='audio'` 且 `mediaUrl` 非空。**未做、记录延后**：`/p/:slug` 公开落地页（`PublicPage.tsx`）有同样的缺口——回复链接"回的是你那条"会跳到这个页面，如果原始回应是录音，那里目前也只有文字。没有顺手一起改，是因为音频回放路由 `/api/blessings/:id/audio` 要求登录且必须是收发双方才能拉取，而公开页按设计是任何人免登录可看——直接把 `mediaUrl` 塞进 `PublicPage` 返回值，播放器对多数访客会是一个播不出来的坏控件。这两者的权限模型冲突需要先决定（比如给已发布的公开录音单独开一条免鉴权但仍按 blessing id 查的路由，防止越权拉到别的祝福的音频），不是照抄 B-85/B-93 模式就能顺手带上的小改动，记 BACKLOG 留给下一轮专门讨论。

全部改动 `pnpm verify` 201 测试、`pnpm test:e2e` 13 个全绿，`openspec validate --strict` 通过。
