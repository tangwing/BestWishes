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

- [ ] 4.1 新增 `AudioStoragePort` 接口（`save(id, buffer) -> url`、`read(id) -> buffer`）；本机落盘实现（存到配置目录，同 PGlite 的"先落盘、生产再换驱动"策略）
- [ ] 4.2 新增依赖 `@fastify/multipart`，音频上传路由接收 `multipart/form-data`，校验文件大小与时长（时长校验需要解出音频元数据，找一个轻量方案，如读 WebM 容器头或限制客户端必须同时提交时长字段并服务端做合理性校验，不追求frame-accurate）

## 5. 打分管线编排

- [ ] 5.1 定义 `AsrProvider` 可插拔接口（输入音频、输出转写文本 + 词级时间戳 + 置信度），仿 `ModerationProvider` 的可插拔模式
- [ ] 5.2 定义 `SincerityEvaluator` 可插拔接口（输入转写文本 + 请求原文，输出真诚度/个性化标签 + 置信度，内建双采样不一致转低置信度的逻辑）
- [ ] 5.3 实现 `RuleBasedAudioScoringProvider`（P2 默认、开发/测试/演示用）：`AsrProvider` 返回一个可配置的假转写（测试注入固定文本，或对音频做最基础的静音比例分析）；`SincerityEvaluator` 用简单规则（如是否包含请求原文中的关键词）模拟"个性化"判定 —— 目的是让整条链路在没有真实云账号的情况下可跑通、可测试、可 demo，接口契约与未来接真实云 API 完全一致
- [ ] 5.4 挑战式真人校验：请求录音前下发随机验证词（短语/数字），打分管线校验转写文本中是否出现该验证词及大致时序
- [ ] 5.5 `audio-scoring-service` 编排以上环节：转写 → 安全检查（复用 `ModerationProvider`，命中 violation 直接驳回、suspect 转现有人工队列）→ 完整性 → 专注度 → 真诚度/个性化 → 真人校验 → 汇总为多维标签输出，不产出单一分数
- [ ] 5.6 超时保守处理：复用 `scans.ts` 的定时扫描模式，配置 `audioScoringTimeoutSeconds`，超时未出结果转人工复核队列，回应者侧显示"评估中"占位
- [ ] 5.7 集成测试：用 `RuleBasedAudioScoringProvider` 覆盖 spec 里的关键场景——命中 violation 驳回、suspect 转人工队列、有稿子完整/部分朗读、无稿子自由表达、验证词缺失转人工、评估结果不一致转人工、超时转人工、多维标签不含单一分数

## 6. 服务端应用层 + 路由

- [ ] 6.1 `wish-request-service`：发布（含内容安全检查）、撤回（终态，不提供重新发布）、删除（二次确认语义，不影响已有回应）、广场分页查询、回应列表查询（仅作者可访问，不设数量上限）
- [ ] 6.2 `wish-request-matching-service`：复用 `packages/domain/src/audience.ts` 的匹配纯函数，发布时计算候选人快照 + 逐个建 `wish_request_matched` 通知；零候选人时不阻止发布
- [ ] 6.3 路由：`POST /api/wish-requests`、`GET /api/wish-requests`（广场，未登录可访问）、`GET /api/wish-requests/:id`、`POST /api/wish-requests/:id/withdraw`、`DELETE /api/wish-requests/:id`、`GET /api/wish-requests/:id/responses`（仅作者）、音频上传路由、`GET /api/audio/:id`（回放，仅收发双方可访问）
- [ ] 6.4 `blessing-service.submit` 接入：`scope='wish_response'` 时校验 `requestId` 指向的请求存在（同 B-64 的 `replyToBlessingId` 校验模式，防伪造）、允许 `contentType=audio`、提交后异步触发 `audio-scoring-service`
- [ ] 6.5 集成测试：`app.inject` 覆盖"发布请求 → 候选人收到通知 → 未登录也能浏览广场 → 登录用户录音回应 → 打分 → 请求人收件箱看到回应（不含评分细节）→ 回应者能看到自己的多维反馈"全链路

## 7. 前端

- [ ] 7.1 请求广场页：分页列表，未登录可浏览，点击响应引导登录
- [ ] 7.2 发布请求页：处境描述 + 可选稿子输入框，复用现有撰写页的静心引导风格
- [ ] 7.3 录音组件：`MediaRecorder` 录制 + `AnalyserNode` 实时波形渲染 + 计时 + 时长上下限校验 + 提交
- [ ] 7.4 回应者查看自己的多维反馈（标签形式，不展示单一分数）
- [ ] 7.5 请求人查看某条请求的回应列表页（不展示评分细节）
- [ ] 7.6 导航加"祝福请求"入口
- [ ] 7.7 `pnpm --filter @bestwishes/client typecheck` 通过，手动过一遍浏览器录音流程（无头环境可能拿不到真实麦克风，需人工或用预置音频文件走一遍）

## 8. 端到端与收尾

- [ ] 8.1 e2e：用预置音频文件模拟上传（不依赖真实麦克风），覆盖"发布请求（附稿子）→ 另一账号浏览广场并录音回应 → 请求人收件箱看到回应"的关键路径
- [ ] 8.2 `pnpm verify` 全绿；`pnpm test:e2e` 全绿
- [ ] 8.3 `docs/DEMO.md` 补充祝福请求 + 音频回应的走查步骤
- [ ] 8.4 `openspec validate add-p2-wish-request-audio --strict` 通过
- [ ] 8.5 BACKLOG.md / CHANGELOG.md 记录本次变更；PROMPT_LOG.md 记录驱动本次变更的用户 prompt
