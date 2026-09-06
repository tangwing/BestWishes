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
- [ ] 5.5 `audio-scoring-service` 编排以上环节 + 与 `blessing-service`/`transitionAndPersist`/现有审核工单机制对接——**下一步优先做这个**，见下方"设计备忘"
- [ ] 5.6 超时保守处理：复用 `scans.ts` 的定时扫描模式，配置 `audioScoringTimeoutSeconds`，超时未出结果转人工复核队列，回应者侧显示"评估中"占位
- [ ] 5.7 集成测试：覆盖 spec 里的关键场景——命中 violation 驳回、suspect 转人工队列、有稿子完整/部分朗读、无稿子自由表达、验证词缺失转人工、评估结果不一致转人工、超时转人工、多维标签不含单一分数

**5.5 设计备忘（继续实现时先读这个，避免重新想一遍）**：
- 音频响应不走 `blessing-service.submit()` 现成的"先落 body 再同步查 moderation"路径（音频没有 body，要先转写才有文本）。做法：`audio-scoring-service` 自己组一条 `draftRecord`（`contentType='audio'`, `scope='wish_response'`, `body=''`, `media.transcript=null`）→ `transitionAndPersist(..., 'submit', ...)` 进 `verifying`（复用状态机，不重新发明）→ 转写 → 把 transcript 写进 `media.transcript` → `moderation.check({text: transcript, occasion})`（复用现成 `ModerationProvider`，同文本流程）。
- **命中 violation**：`transitionAndPersist(..., 'auto_violation', ...)`，不跑后续打分、不建 `audio_scores` 记录（spec 明确要求）。
- **命中 suspect 或 pass**：都继续跑完整性/专注度/真诚度/真人校验，写一条 `audio_scores` 记录（这几项是"内容质量反馈"，跟"安全不安全"是两回事，不用等人工过审）。然后 suspect 走现有的建工单逻辑（照抄 `blessing-service.submit` 里 `outcome.createTicket` 那段，走 `reports` 仓储，不新建复核机制）；pass 走 `transitionAndPersist(..., 'auto_pass', ...)` + 设 `holdUntil`（沿用文本的 hold 节奏，走同一个 `scans.publishReady` 扫描发布）。
- 真人校验（liveness）不通过时：spec 要求"转人工复核，不直接驳回"——处理成跟 suspect 同一条路径（建工单），不是单独一套。
- 这几步和 `blessing-service.submit()` 现有的 outcome 分支高度相似但不完全复用同一个函数（`submit()` 是同步定式，这里转写是"已经发生"的既定输入，不需要重新校验字数下限等文本专属规则）——参照抄写为主，不用抽象出共享函数（现在只有两个调用点，抽象为时尚早，YAGNI）。

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
