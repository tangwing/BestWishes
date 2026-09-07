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
- [ ] 6.3 HTTP 路由（`interface/http/routes.ts`）：`POST /api/wish-requests`、`GET /api/wish-requests`（广场，未登录可访问）、`GET /api/wish-requests/:id`、`POST /api/wish-requests/:id/withdraw`、`DELETE /api/wish-requests/:id`、`GET /api/wish-requests/:id/responses`（仅作者）、`GET /api/wish-requests/mine`、`GET /api/audio-challenge`（发一次性验证词）、音频上传路由（`multipart/form-data`，接 `@fastify/multipart`）、`GET /api/audio/:id`（回放，仅收发双方可访问，需要先查 blessing 确认权限）、`GET /api/blessings/:id/audio-feedback`（回应者查看自己的多维反馈）——**下一步做这个**
- [x] ~~6.4~~ 已在 5.5 里说明：不改 `blessing-service.submit`，音频走独立的 `audio-scoring-service.submit`
- [ ] 6.5 HTTP 层集成测试（`app.inject`，而不是直接调 `ctx.app.xxx`）：上传走真实的 multipart 编码，覆盖跟 6.3 路由对应的权限边界（未登录不能发布/回应/看别人的回应列表、只有收发双方能拉音频文件）——`wish-request-flow.test.ts` 已经在 application 层覆盖了业务逻辑分支，这里补的是"路由层有没有接对、鉴权有没有漏"

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
