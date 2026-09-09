## Context

P1 交付的架构（见归档的 `add-p1-text-blessing`、`openspec/specs/`）已经有几块可以直接复用的地基：

- `Blessing` 聚合 + 状态机（`draft → verifying → published → ...`）、`transitionAndPersist` 统一落状态 + 投递扇出。
- `ModerationProvider` 可插拔接口，**其原始需求已写好"输入为祝福文本（音视频形态传转写）"**——本变更第一次真正用到这句话。
- `AudienceFilter` / haversine 匹配（`packages/domain/src/audience.ts`）——距离 + 标签匹配的纯函数逻辑，`wish-request-matching` 直接复用，不重新发明。
- 内存 + PGlite 双实现同 ports 的模式；`BW_*` 环境变量式可调配置（`packages/domain/src/config.ts`）。
- 一个已经用了两次的教训（B-63）：**幂等标记 + "重新发布"类操作容易互相坑**，本次请求的撤回逻辑直接复用"撤回是终态"的现成模式，不再发明新的可恢复状态。

新增的、P1 完全没有的东西：**二进制媒体文件**（音频）。P1 全程只有文本 + JSON，数据层是纯关系型 + PGlite。音频引入了文件存储、上传协议、时长/编码约束、以及一整条"听不懂机器就得转成文字再判断"的管线——这是本设计的重点。

用户明确要求：**音频打分的算法是本次最难、最值得深入设计的部分**；其余（请求撰写、广场浏览、匹配推送、录音 UI）复杂度都低于它，且很大程度是已有模式的复用。因此下面的 Decisions 里，"打分管线"一节写得最细，其余从简。

## Goals / Non-Goals

**Goals:**
- 请求人能写一段处境描述 + 可选稿子，发布后既进广场、也触发匹配推送。
- 回应人能对着请求录一段音频（带实时波形），提交后经过一条可解释、可复核、不单纯依赖 LLM 黑盒的打分管线，拿到"用心反馈"。
- 打分管线的每一环都可替换（同 `ModerationProvider` 的哲学）：P2 用云 API + 规则层起步，不排除以后换自建模型。
- 输出永远是多维标签 + 置信度，不是一个可比较、可攀比的单一分数（vision.md 硬约束）。

**Non-Goals:**
- 不做视频（P3）。
- 不做声纹鉴定 / AI 合成语音检测（研究报告：这是"军备竞赛"，MVP 不能拿它当唯一闸门；先用挑战式真人校验兜底，声纹/深伪检测作为后续硬化项留在 BACKLOG）。
- 不做打分模型自建/微调（P2 全部调用现成云 API + 通用 LLM；数据量不够，自建没有意义，见研究报告"建议 2"）。
- 不做悬赏 / 资金（P3）。
- 不做"回应人之间比分数"的任何排行——多维标签不对外聚合成可比较的数字。

## Decisions

### 1. 数据模型：新聚合 `WishRequest` + `Blessing.scope` 加一个值

**决定**：新增一个独立聚合 `WishRequest`（不是 `Blessing` 的子类型），字段：`id`、`authorId`、`situationText`（处境描述）、`scriptText: string | null`（可选稿子）、`state`（`published | withdrawn | deleted`）、`createdAt`、`recipientCandidateIds`（匹配推送时定格的候选人快照，复用 P1"收件人快照"的思路防止后加入者干扰已发通知）。回应仍然是一条 `Blessing`：`scope` 加一个新值 `'wish_response'`，`contentType = 'audio'`，新增字段 `requestId: string | null`（回应哪条请求；广播/回复场景恒为 null）。

**理由**：请求不是"祝福"，它没有正文送达的问题，也不需要 `verifying/published/expired` 这套面向"内容能不能被别人看到"的状态机——它只需要"公开 / 收回 / 删除"三态。把它做成独立聚合，状态机保持小而对；回应复用 `Blessing` 是因为回应**就是**一条祝福（要走审核、要出现在收件箱和发件箱、要能撤回）——只是多了"回的是哪条请求"这个关联，跟 P1 的 `replyToBlessingId` 是同一个模式（B-64 刚做过，这次直接照搬：校验 `requestId` 指向的请求确实存在，防止伪造）。

**备选方案**：把请求也建模成一种特殊的 `Blessing`（`scope='request'`）。放弃理由：请求没有"发布即校验、延迟送达"这套语义（它不是发给谁看的内容，是发给谁来响应的召集），硬塞进 `Blessing` 的状态机会导致很多字段（`recipientIds`、`deliveredAt`、`expiresAt`）名不副实，违反"最简方案"。

### 2. 请求的发现方式：广场 + 匹配推送并存

**决定**：`GET /api/wish-requests` 返回公开广场列表（分页，按最近发布排序）；同时请求发布时，`wish-request-matching` 复用 `packages/domain/src/audience.ts` 现成的 haversine + 标签匹配逻辑，对有位置/标签画像的用户算出候选人集合，定格快照，逐个建通知（新 `NotificationKind = 'wish_request_matched'`）。两条路径**互不排斥、互不影响**——广场列表不受匹配结果影响，匹配到的人也仍然会在广场看到全部请求。

**理由**：这是用户明确选的选项（"两者都要"）。技术上几乎零额外成本——匹配算法已经在 `audience-service` 里跑过一遍，这次只是换个触发方向（不是"发送者选受众"，是"系统帮请求方推给可能感兴趣的人"），公式和代码可以直接抽出来复用而不是重写。

### 3. 回应上限：不设，请求人自己在列表里挑

**决定**：`WishRequest` 不设 `maxResponses`；`GET /api/wish-requests/:id/responses`（仅请求作者可访问）返回全部回应，按时间倒序。

**理由**：用户选择的选项。产品上这也更贴近"祝福请求"的本意——请求人未必只想要一条回应，可能想收到很多人的心意（vision.md："收到来自世界各地用心的祝福"，是复数）。技术上比设上限更简单：不需要"命中人数超过上限拒绝群发"那套校验（那是 P1 广播模型的产物，这里没有对应的"广播风险"——回应是回应人主动选择去做的，不会出现"骚扰陌生人"的问题）。

### 4. 音频录制与上传

**决定**：客户端用 `MediaRecorder API` 录制（`audio/webm;codecs=opus`，浏览器原生支持好、体积小），用 `AnalyserNode` 实时读时域数据画波形（纯前端渲染，不产生网络请求，不是打分输入）。录制时长 SHALL 有上限（配置项 `audioMaxDurationSec`，默认 180 秒）和下限（`audioMinDurationSec`，默认 5 秒——太短大概率是误触或没说什么）。上传用 `multipart/form-data`（新依赖 `@fastify/multipart`），服务端先落盘（demo/开发用本机目录，同 PGlite 的"先能跑、生产再换"策略），成功后异步（不阻塞响应）触发打分管线。

**理由**：`MediaRecorder` 是所有现代浏览器的标准 API，不需要额外的客户端依赖；`opus` 编码体积小（对存储和 ASR 上传都友好）。落盘而不是一开始就接对象存储，是延续 P1 对 PGlite 的态度——先用最简单的东西把链路跑通、可测试，生产环境换存储驱动时不动业务代码（存储走一个 `AudioStoragePort` 接口，本机实现和未来的 S3 兼容实现都实现它，同 `drizzle-orm/pglite` → `postgres-js` 的换驱动模式）。

**备选方案**：直接前端上传到对象存储（预签名 URL）。放弃理由：现在还没有对象存储账号/选型，属于 P2 后续硬化项，不阻塞先把整条打分链路做出来能跑。

### 5. 打分管线（本次设计重点）

这是用户点名"最难"的部分。设计原则直接继承研究报告（`docs/research/2026-09-01-funds-ai-licensing.md` 领域二）和 vision.md 的硬约束：**可解释优先于黑盒**、**多维标签 + 置信度，绝不是单一分数**、**LLM 打分要做偏差缓解**、**真人校验用低成本可解释方案，不拿"军备竞赛"式的深伪检测当唯一闸门**。

```
                          音频打分管线（audio-scoring-service）
  +------------------------------------------------------------------------------+
  |                                                                              |
  |   录音上传                                                                    |
  |     |                                                                        |
  |     v                                                                        |
  |  [1] ASR 转写 --------------------------> 转写文本 + 词级时间戳 + 置信度        |
  |     |                                          |                             |
  |     |                                          v                             |
  |     |                              [1a] 复用 ModerationProvider              |
  |     |                                   （安全审核：涉政/色情/诈骗...）        |
  |     |                                   命中 violation/suspect 直接按         |
  |     |                                   现有 content-moderation 规则处理，    |
  |     |                                   不必等后面的打分跑完                  |
  |     v                                                                        |
  |  [2] 稿子对齐（仅当 scriptText 非空）                                          |
  |     |  有稿子 -> 强制对齐 -> 脚本覆盖率 / 缺失段落 / 是否念完                    |
  |     |  无稿子 -> 跳过，完整性只看转写文本非空、非乱码（复用文本审核的            |
  |     |            "刷屏/空/全标点"规则，判定逻辑是纯函数，可单测）                |
  |     v                                                                        |
  |  [3] 专注度 / 流畅度信号工程（纯规则，基于转写时间戳 + 音频波形，                |
  |     |  不调用任何模型）：                                                     |
  |     |    - 停顿分布：静音段直方图、异常长停顿（>3s）计数                        |
  |     |    - 语速稳定性：字/秒滑窗序列的均值与方差                                |
  |     |    - 犹豫词：转写文本命中"嗯/呃/这个/那个"词表的密度                      |
  |     |    - 能量曲线：RMS 是否稳定（不做 F0，MVP 先用最便宜能拿到的信号）         |
  |     |  加权组合成"专注度"标签（高/中/低），权重是配置项，不是硬编码——            |
  |     |  可解释、可单测、不依赖外部服务                                          |
  |     v                                                                        |
  |  [4] 真诚度 / 个性化 LLM 评估（调用大模型，输入=转写文本 + 请求原文）           |
  |     |    - 个性化实体计数：提取"是否呼应了请求人的具体处境/细节"                |
  |     |    - 真诚度定性：固定 rubric + few-shot 锚点，温度=0，双采样取一致        |
  |     |      结果（不一致时标记低置信度，进人工抽检，而不是取平均掩盖分歧）        |
  |     |    - 只产出标签（如"高个性化/一般/模板化"）+ 置信度，不产出 1-10 分       |
  |     v                                                                        |
  |  [5] 真人校验（挑战式，MVP 方案）                                              |
  |     |    - 请求录音前，服务端下发一个随机短语/数字串（如"请在开头说出：        |
  |     |      372"）                                                            |
  |     |    - 校验转写文本里出现了这个挑战词，且出现位置在录音前 N 秒内            |
  |     |    - 通过 = livenessPassed=true；不通过 = 标记 suspect，进人工队列       |
  |     |      （不直接拒绝——可能是设备识别问题，不是恶意）                        |
  |     v                                                                        |
  |  [6] 汇总输出：{ completeness, focus, sincerity, personalization,            |
  |                  livenessPassed } 全部是"标签+置信度"，无聚合分数              |
  |     |                                                                        |
  |     +--> 低置信 / suspect / violation 任一命中 -> 人工复核队列（复用           |
  |     |     content-moderation 现成的工单机制，不新建一套）                      |
  |     |                                                                        |
  |     +--> 全部通过 -> 回应正常投递；回应人看到自己的多维反馈                     |
  |                                                                              |
  +------------------------------------------------------------------------------+
```

**各环节的技术选型建议**（云 API 优先、可插拔、P2 不自建）：

| 环节 | P2 推荐 | 理由 | 后续硬化方向（不在本变更范围） |
|---|---|---|---|
| ASR | 阿里云智能语音交互（录音文件识别）或腾讯云语音识别，二选一，走一遍真实祝福样本 A/B（准确率 + 时间戳质量 + 成本）再定 | 免运维、起量最快、中文商用级；研究报告"建议1"里"审核买、评估先用通用大模型"的同一思路延伸到 ASR | 自建 Paraformer/SenseVoice（FunASR，中文强、权重免费），量起来后降本 |
| 强制对齐 | Charsiu（中文拼音音素对齐，开源） | 唯一对中文拼音支持较成熟的开源方案；MFA 缺成熟中文拼音模型，WhisperX 面向英文对齐生态更成熟 | 若 Charsiu 中文效果不达预期，评估 WhisperX + 中文声学模型自训 |
| 专注度/流畅度信号 | 纯规则/信号工程（见上），不调用任何专门模型 | 可解释、零额外成本、可单测；研究报告明确建议"可解释优先，不追求端到端黑盒" | 引入专门的 disfluency 检测模型（帧级检测嗯/呃/重复），提升准确率 |
| 真诚度/个性化 | 复用现有 `ModerationProvider` 同款可插拔接口思路，新增 `SincerityEvaluator` 接口，P2 实现调用通用大模型 API | 复用项目已经踩过坑、写好偏差缓解 SOP 的模式（rubric + 温度0 + 双采样） | 积累人工标注校准集后，评估微调小模型自建以降本（研究报告"建议2"） |
| 真人校验 | 挑战式（随机短语/数字，验证转写文本 + 粗略时序） | 成本几乎为零（复用同一次 ASR 调用的结果）、可解释、MVP 够用 | 声纹一致性 API（同一用户多次录音比对）；AASIST 类合成检测作为"疑似"信号（不做闸门） |

**为什么不现在做声纹/深伪检测**：研究报告明确指出这是"军备竞赛"——新的 TTS 一出，现有检测模型就可能失效，不能拿它当唯一闸门去挡人。挑战式校验虽然更"笨"，但可解释、成本低、不会因为模型过时而集体失效，作为 MVP 的真人校验完全够用；声纹/深伪检测放进 BACKLOG 作为后续安全硬化项，等平台量起来、确实出现"批量刷录音"问题时再上。

**为什么打分是"异步、提交后"而不是"录制过程中实时"**：用户原话是"能看到录音过程和分数"——这里拆成两件事：**录音过程**（实时波形，纯前端、零延迟）在 MVP 就做；**分数**（多维标签）需要完整的转写+对齐+LLM 调用，无法在录音进行时实时算出（流式 ASR + 实时打分是显著更难的工程问题，且现阶段没有必要——用户提交后等几秒到几十秒拿到反馈，产品体验上完全可接受，类比现有文本祝福"发布即校验、延迟送达"的既有心智模型）。如果评审时希望"录制中间就有阶段性反馈"，那是范围扩大，建议留到后续迭代。

### 6. 内容形态放开：`blessing-authoring` 的"祝福形式"要求改窄

**决定**：`contentType != text` 的祝福不再一律拒绝——`audio` 放行（且仅当 `scope = 'wish_response'`；P1 的群发/回复场景暂不开放音频，范围收在"回应祝福请求"这一个场景，避免一次变更铺得过大）。`video` 继续拒绝。

**理由**：用户明确说"先把视频推到 P3"，且这次讨论的响应形态就是针对请求场景。P1 的群发/回复要不要开放音频是独立的产品决策，留到后续再讨论，不在本变更里顺带扩大范围（"外科式改动"原则）。

### 7. 祈福广场：把 `WishRequest` 当社区 Topic 建模（2026-09-09 用户点评后并入）

**背景**：用户试用 Demo 后要求把"祝福请求"重塑成一个社区式的**祈福广场**——列表只看摘要 + 统计，回应内容点进详情才看，并明确"参考社区成熟的 Topic + Reply 建模"。

**决定（方案 A）**：`WishRequest` 就是 Topic，回应**保持是一条 `Blessing`**（`scope='wish_response'` + `requestId`，现状不动）。为支撑"列表只给统计"，`WishRequest` 新增两个**写入时维护**的聚合字段：

| 字段 | 含义 | 维护时机 |
|---|---|---|
| `responseCount` | 当前处于 `published` 的回应条数 | 一条 `wish_response` Blessing 进入 `published` 时 `+1`；离开 `published`（撤回 / 下架 / 删除）时 `-1`（下限 0） |
| `lastResponseAt` | 最近一条回应发布的时间（ISO） | 回应进入 `published` 时刷新；单调，不随回应下架回拨（"最后活跃"是软信号，近似即可） |

```
   祈福广场列表 GET /api/plaza                      祈福详情 GET /api/plaza/:id
   -----------------------------                    ---------------------------
   [ WishRequestSummary, ... ]                      { ...situation, script,
     - id                                             responseCount, lastResponseAt,
     - situationExcerpt (截断)                         responses: [ ResponseView, ... ] }
     - tags                                                        ^
     - responseCount    <- 直接读聚合列，O(1)                       |
     - lastResponseAt                                    点进来才 listByRequestId 拉回应
   不含任何回应正文 / 音频 URL
```

**为什么不现在引入独立的 `WishResponse` 实体（方案 B）**：`WishResponse` 目前唯一能独占的字段是"是否被采纳/获得悬赏"——而悬赏机制（谁出资、如何托管、如何验收）在 AGENTS.md §6 里仍是未定的开放问题。按"不为假设中的未来做设计"，现在引入等于过度设计。留一条平滑升级路径：P3 悬赏若确实需要"请求人从回应里挑一条给赏金"（= 论坛"接受回答"），那时再引入 `WishResponse`，把 `blessingId` 迁进去即可——`responseCount` / `lastResponseAt` 这层 Topic 统计无论 A/B 都要有，不白做。

**为什么聚合字段写入维护、不在列表渲染时 `COUNT(*)`**：config.yaml 写明目标 100M+ 用户。广场列表每次渲染都对 `blessings` 按 `request_id` 分组计数 = N+1 扫描，规模一大就崩。所有成熟论坛（Discourse 的 `topics.posts_count`、Flarum 的 `discussions.comment_count`）都是在帖子增删时维护一个反规范化计数列。本项目照做。一致性风险：维护逻辑漏一处会导致计数漂移——用一个可单独跑的对账查询（`SELECT count(*) FROM blessings WHERE request_id=? AND state='published'` 对比 `wish_requests.response_count`）作为测试断言 + 运维兜底，不做分布式事务。

**"我的请求"降为筛选项**：`GET /api/plaza?filter=mine` 复用同一个列表接口 + 查询，不再有独立路由 / 服务方法 / 页面。作者视角额外能看到 `pending_review` / `withdrawn` 状态的自己那几条（广场默认只列 `published`）。

### 8. 导航精简 + 回响移除

**决定**：导航从 8 项砍到 6 项，路由重命名，删除"回响"。

```
  旧                          新                        路由变化
  --------------------------  ------------------------  --------------------------------
  祝福请求  /wish-requests     祈福广场  /plaza          + /plaza/:id 详情页（新）
  我的请求  /wish-requests/mine   -> 并入 /plaza?filter=mine
  写祝福    /compose           传递善意  /give           /give 里合并"我发出的"
  发出的    /records              -> 并入 /give
  收件箱    /inbox             我的福袋  /pouch          仅改名
  回响      /streak              -> 删除，累计数进个人空间
  个人空间  /profile           个人空间  /profile        + 展示"你已传递 N 份善意"
  审核台    /moderation        审核台    /moderation     不动
```

保留不变的路由：`/`、`/login`、`/agreement`、`/moderation`、`/p/:slug`、`/blessings/:id/feedback`。发送成功确认页从 `/sent/:id` 挪到 `/give/sent/:id`（跟父页对齐）。

**回响移除的处理**：
- `packages/domain` 的 `streak` 模块（按用户所在地区自然日聚合、连续天数计算）**整块删除**——这套日期 / 时区逻辑是回响独有的，没有别处复用。
- 累计善意数改为对 `blessings` 直接计数：`count(state='published' AND authorId=?)`。不分桶、不算连续。语义上就是"你至今送出去、且还有效的祝福有多少份"。
- 展示位置：个人空间的一个只读数字（"你已传递 N 份善意"），只对本人可见，MUST NOT 转成积分 / 等级 / 可变现物——这几条硬约束从 `blessing-streak` 原样继承到 `user-profile`。
- `blessing-streak` 能力 spec 整体 REMOVED；`user-profile` 补一条"累计善意数"Requirement。

**口径统一为"善意"**：写祝福 → 传递善意、发出的 → 我的善意（列表标题）、回响累计 → "你已传递 N 份善意"。"祝福"仍用于指单条内容（一条祝福 / 回一段祝福），"善意"用于指行为和累计。

## Risks / Trade-offs

- **[风险] 云 ASR 成本随音频时长线性增长，且演示/开发环境没有真实 API key**
  → **缓解**：架构上 ASR 走可插拔接口（同 `ModerationProvider`），P2 开发/测试/演示默认用一个 `RuleBasedAudioScoringProvider`——不真的调云 API，而是对已解码的音频做时长/静音比例等最基础的规则判断 + 对转写环节用一个可配置的假转写（测试时注入固定文本），保证整条链路可在没有云账号的情况下跑通、可测试、可 demo；真实云 API 的接入是"换驱动"层面的事，接口契约不变。这与 P1 的 `RuleBasedProvider`/`UnavailableProvider`、PGlite/`postgres-js` 完全是同一个套路。
- **[风险] LLM 真诚度评估的偏差（位置偏差、冗长偏差、自我偏好偏差）**
  → **缓解**：设计里已经内建：固定 rubric + few-shot 锚点、温度=0、双采样不一致则标记低置信度转人工，不用"平均掩盖分歧"这种会隐藏问题的做法。
- **[风险] 挑战式真人校验被绕过（提前录好一段包含数字串占位的音频，之后再拼接）**
  → **缓解**：MVP 接受这个风险敞口——研究报告本身也承认"这是军备竞赛"，挑战式方案的定位是"低成本挡住大部分随手复用/偷懒行为"，不是"绝对防伪"。命中 suspect 转人工复核兜底；真要对抗高级伪造要靠后续的声纹/深伪检测硬化，不在 P2 范围。
- **[风险] 打分管线全异步，回应人提交后要等多久才能看到反馈不确定**
  → **缓解**：`audio-scoring-service` 的处理复用 P1 `scans.ts` 的"定时扫描 + 幂等标记"模式（不是新发明一套排队系统），配置一个 `audioScoringTimeoutSeconds` 超时保守策略——超时未出结果时按"进人工队列"处理，不无限期挂起用户体验，回应人侧看到"评估中"占位（类比 P1 的"校验中"）。
- **[权衡] 请求人看不到回应人的具体评分**：这是有意为之（避免攀比场），但也意味着请求人无法用分数做"自动精选排序"，只能自己看内容。若未来产品需要"精选靠前展示"，需要另开讨论要不要暴露一个内部的、不可比较的"精选建议"布尔位——这次不做，等有真实需求再说。
- **[风险] `responseCount` / `lastResponseAt` 反规范化计数漂移**：任何一条"回应进/出 `published`"的路径漏维护计数，广场列表就会显示错误的回应数。
  → **缓解**：维护点收敛到一处——`wish_response` 的状态落地统一走 `audio-scoring-service` / `transitionAndPersist`，在那里 hook 计数增减，不散落在多个 service。加对账测试：跑完一段生命周期后断言 `wish_requests.response_count == COUNT(published wish_response blessings)`。不引入分布式事务（同进程 + PGlite，一次请求内顺序写即可）。
- **[权衡] 删除回响 = 丢掉"连续天数"这个留存钩子**：连续天数确实能提升日活，但它是 KPI 味的激励，跟 vision.md"不做攀比、不做 KPI"的调性有张力，用户明确要求砍掉。累计善意数保留了"个人成长感"的核心，去掉了打卡压力。若日后要重做留存机制，另立 change 讨论，不在这里留半套。

## Migration Plan

1. 领域层：`BlessingScope` 加 `'wish_response'`；新增 `WishRequest` 类型 + 极简状态机（`published/withdrawn/deleted`）+ 纯函数信号打分规则（停顿/语速/犹豫词密度，可独立单测，不依赖 ASR/LLM 真实调用）。
2. 共享层：`WishRequest` 的提交/查询 Zod schema；`submitBlessingSchema` 放开 `contentType='audio'`（仅 `scope='wish_response'` 时）。
3. 数据层：新增 `wish_requests` 表；`blessings.request_id` 列；新增音频评分结果表（区别于 `moderation` 字段，语义不同）；drizzle 迁移；内存仓储同步。
4. 服务端：`wish-request-service`（发布/撤回/删除/广场分页查询/回应列表）、`wish-request-matching-service`（复用 `audience.ts` 的匹配纯函数）、`AudioStoragePort`（本机落盘实现）、`audio-scoring-service`（编排 ASR→对齐→信号→LLM→校验→汇总，P2 默认接 `RuleBasedAudioScoringProvider`，真实云 API 作为可切换实现）、路由（`POST /api/wish-requests`、`GET /api/wish-requests`、`GET /api/wish-requests/:id/responses`、`POST /api/wish-requests/:id/withdraw` 等、音频上传路由）。
5. 前端：请求广场页、发布请求页（含可选稿子输入框）、录音组件（`MediaRecorder` + `AnalyserNode` 波形 + 提交后的多维反馈展示）、请求人查看回应列表页。
6. 测试：领域层信号打分规则的纯函数单测（合成转写+时间戳数据，不依赖真实音频）；集成测试用 `RuleBasedAudioScoringProvider` 跑通"发布请求→匹配推送→录音提交→打分→反馈"全链路；e2e 用预置音频文件模拟上传（无头浏览器不稳定触发真实麦克风录制）。
7. 回滚：全部是新增表 / 新增字段（`request_id` 可空）/ 新增可插拔 provider，没有修改已有表结构或已有状态机的合法转移路径，出问题可整体回退代码，不需要专门的数据回滚脚本。

### 祈福广场重构 + 导航精简（追加步骤，2026-09-09）

8. 领域层：`WishRequest` 加 `responseCount` / `lastResponseAt`；**删除 `packages/domain/src/streak.ts`** 及其测试；累计善意数改为纯计数（可放 `blessing-records` 或直接在服务层算）。
9. 数据层：`wish_requests` 加 `response_count`（int，默认 0）/ `last_response_at`（timestamptz，可空）两列；drizzle 迁移；内存仓储同步。**不新增表**。
10. 服务端：回应进/出 `published` 时维护聚合列（收敛到 `audio-scoring-service` / 状态落地处）；`GET /api/plaza`（列表，带 `?filter=mine`，只返回摘要 + 统计）、`GET /api/plaza/:id`（详情，含回应列表）取代 `GET /api/wish-requests` + `/wish-requests/:id/responses`；累计善意数进个人空间的 `GET /api/me` 或 profile 接口。删除 streak 相关路由 / 服务。
11. 前端：`WishRequests.tsx` → 广场列表（摘要 + 统计 + `?filter=mine`）；新增祈福详情页；`Compose.tsx` 重做为"传递善意"并入 `Records.tsx` 的发件箱；`Inbox.tsx` 改名"我的福袋"；**删除 `Streak.tsx`**；`Profile.tsx` 展示累计善意数；`App.tsx` 导航 8 → 6 项；路由表重写。
12. 测试：`responseCount` 对账断言（生命周期跑完后计数一致）；广场列表断言"不含回应正文 / 音频 URL"；详情页断言"点进去才有回应"；e2e 更新为新路由 + 新导航文案；删除 streak 的测试。
13. spec 同步：`wish-request` delta 改（广场列表 / 详情 / 我的祈福筛选 / 聚合计数 / 回应进福袋）；新增 `blessing-records`（发件箱并入传递善意、收件箱入口改名福袋）/ `user-profile`（去坚持记录入口、加累计善意数）的 MODIFIED delta；`blessing-streak` 整体 REMOVED delta。`blessing-delivery` 不动——那里的"收件箱"是投递条目概念本身，只有导航入口的展示名变了（归 `blessing-records` 管）。
