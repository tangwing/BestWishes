# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Planned — 2026-09-13 阶段性复盘：三步路线的 spec change（B-94, B-95, B-96）

用户叫停功能迭代，要求先复盘两件事：现在的 Demo 是否符合最初的理念；下一步是先做移动端 App 还是先把视频打分建完。完整分析见 PROMPT_LOG.md。

**复盘结论**：理念 → 领域模型 → 后端能力这条链路是好的（201 测试、真外键、可插拔审核），但**理念 → 用户此刻的感受**这条链路还没开始建。把首次善意的路径从代码里数出来是 **9 步跨 4 个页面**，且全程没有一个具体的人——用户是在对着人口筛选器写信。vision 的使命第一个动词是"激发"，而能激发的东西（祈福广场）被放在动线旁边而非入口。两个备选方向都被否决：现在做原生是把未验证的动线搬进更难改的容器，缺的"手机形态"PWA 全能给；先建视频打分违反 vision"AI 评估是辅助手段不能主导形态"，且录制门槛远高于音频（刚为降门槛做了 B-88），ASR 信任边界（B-70）还挂着。

改为三步走，全部在现有 Web 栈内，规划 artifact 已写完并 `openspec validate --all --strict` 17/17 通过，实现另开会话：

- **B-94 `redesign-kindness-entry`**：把首次善意压到 2 步。新增 `kindness-entry` 能力；**撤销 B-71 定的"广场列表 MUST NOT 含回应正文"**——那是论坛正确但情绪错误的决策，改为列表必须展示最新一条回应摘录（走写入路径维护，不在渲染时扫表）；访客可读文字 / 音频需登录；祈福加匿名发布；受众预览从发送硬门槛降级为可选辅助。**顺带收口一个既有真实缺口**：`wish-request-service.detail()` 对任何人（含访客）下发 `audioUrl`，而 `audio-scoring-service.readAudio()` 只放行"作者或收件人"——第三方在广场点播放必然 403。权限模型改为"广场上 `published` 的回应音频，任何登录用户可播放"，这也是 B-93 遗留的 `/p/:slug` 权限问题的落点。
- **B-95 `add-shareable-blessing-card`**：产品使命是"传递"善意，但传递在产品层几乎没实现——只有一个朴素的 `/p/:slug`，没有 og:image、没有任何用户会想发出去的产物。新增 `blessing-card`（确定性生成、可缓存、不进数据库）与 `blessing-feedback`（**文字祝福的用心反馈**——vision 承诺"始终提供"，管线早已建好却只接在音频上，文字群发发出去一直是石沉大海）；落地页补 og 元信息与音频播放器。唯一的重量级决策是卡片图片怎么生成，design.md D1 列了四个候选（选中：手写 SVG + 一个光栅化依赖 + 服务端捆中文字体；明确否决把无头浏览器塞进生产运行时）。微信 JS-SDK 不在范围——需 appId + 已备案域名（B-42 未办），写了无法验证。
- **B-96 `add-mobile-shell-pwa`**：底部 tab（**首页并入广场 tab**，用户拍板）、390px 版面约束、PWA 可安装、Web Push（`notification` 的 Purpose 里"真实推送通道留到后续"的那个后续）。明确**不做**原生 / RN / 小程序——多端方式仍是 AGENTS.md §6 未决项，要先有留存数据再谈。

三步做完后量三个数：打开→首次善意转化率、收到→24h 回赠率、外链带新占比。这三个数不好看，原生和视频打分都救不了。

### Changed — P2 第一批归档，主 specs 从 10 个能力变成 12 个（B-68）

用户审阅通过后 `/opsx:archive` 了 `add-p2-wish-request-audio`（4 artifact 完成、52/52 tasks 完成）。delta → 主 spec 的同步：新建 `audio-scoring` / `blessing-audio` / `wish-request` / `wish-request-matching` 四个能力共 21 条 Requirement；替换 `blessing-authoring` / `blessing-records` / `content-moderation` / `user-profile` 的 5 条、新增 2 条；`notification` 追加"请求匹配通知"；**`blessing-streak` 整个能力退役**——三条 Requirement 全部 REMOVED，主 spec 的 `## Requirements` 清空，按归档规则删除该文件（"回响/连续天数"这套 KPI 味的激励与 vision"不做攀比"有张力，累计口径已迁到 `user-profile` 的"累计善意数"）。归档前逐条核对了每个 delta 的 Requirement 与主 spec 是否逐字一致，`openspec validate --all --strict` 15/15 通过。代码侧的 dormant 残留（`streak_days` 表、`StreakRepository` 等）仍是 B-74，单独一轮清。

### Fixed — 发布祈福命中候选人时 500；福袋音频回应看不到播放器（B-92, B-93）

用户纠正了 B-91 的既有解释——他说的不是"过一会儿又收到一条"，而是"同一次回应（录音+补充文字）点亮福袋两次，第二次点开只看到文字，感觉这段文字跟录音完全没绑在一起"。排查这句话时，先用真实 curl 直接打运行中的 `pnpm demo`（PGlite，真外键约束）复现，顺手撞见一个更严重、无关的 bug，然后才定位到用户报告的真正根源。

- **B-92（严重）发布带地理位置的祈福、命中候选人时直接 500**：`wish-request-service.publish()` 原来先调 `matchAndNotify()`（写 `notifications.request_id` 外键指回这条待发布的祈福）再 `wishRequests.add()`——记录还没插入，外键就先写引用，PGlite 开着真实约束时直接 `23503` 报错，整条发布请求跟着失败。内存仓储没有外键约束，主力测试从没测出来，只有走真 PG 语义的 `pg-repositories.test.ts` 才会炸，而这条路径此前在那个文件里完全没有覆盖。已修：`add()` 先落库，再 `matchAndNotify()` + `save()` 补上 `recipientCandidateIds`；新增回归测试（`git stash` 验证过确实先失败后通过）。这个 bug 在"祈福作者设了位置、附近有候选人"的场景下 100% 必现。
- **B-93 福袋里的音频回应只显示转写文字，看不到播放器**：用 curl 完整走了一遍链路并反复轮询收件箱/通知接口，确认一次提交只产生一条 Blessing / 一条收件箱记录 / 一条通知——**不存在真正的重复投递**。但收件箱页面点开这条记录只有转写文字，没有播放器或"这是录音"的提示，跟 B-85 是同一类疏漏（`InboxView`/`InboxItem` 一直缺 `mediaUrl` 字段）。这完全能解释用户的感受：不是多投递了一次，是投递的这一条把音频和文字的关联性在 UI 上丢掉了。已修：`inbox-service.ts` 的 `InboxView` 加 `mediaUrl`；`Inbox.tsx` 音频类型加 `<audio controls>` + "这段录音的文字记录："提示语；`wish-request-flow.test.ts` 补回归断言。`wish-request` spec 新增对应场景。遗留：`/p/:slug` 公开落地页有同样的缺口，因音频回放路由要求登录+收发双方鉴权、跟公开页免登录可看的设计冲突，需要先定权限模型，记 BACKLOG 待讨论。

### Added — 祈福回应下能往返回复了；补充文字不再强制（B-88, B-89）

- **祈福详情页新增"回应下的往返回复"**（B-89，真 bug）：一条祈福不该是一次性的"求祝福 → 收祝福"就结束——用户反馈"收到语音祝福后没法回复"，排查后确认不是后端坏了（`scope=reply` 的回信机制本身工作正常），是 `/plaza/:id`（B-71 后主要的交互入口）从来没提供回复功能。现在每条回应下方展示已有的回复（按时间正序，读起来是连续对话）+ 一个回复输入框；`BlessingRepository` 新增 `listRepliesTo`，`wish-request-service.detail()` 递归拼出每条回应的回复链；复用现成的 `POST /api/blessings`（`scope=reply`）提交，没有新开接口、没建独立的评论系统。祈福作者与该回应的作者双方都能发起，回复目标固定是"这条回应涉及的另一方"。`wish-request` spec 新增对应 Requirement。
- **补充文字不再强制，录音下限 5→4 秒**（B-88）：回应祈福时录完音不用再被迫把说的话重新打一遍字。**过程中发现并修了一个连带 bug**：`audio-scoring-service` 原来无论转写是否为空都会送进 `ModerationProvider`，规则实现对空字符串恒判"低有效内容"→ `violation`——文字一旦不强制，"不写字"就会被直接误判违规驳回，跟"取消强制"的初衷正好相反。改成没有转写文本时跳过审核判定、直接按"无法自动核验、转人工"处理（跟"审核服务不可用"同一套保守策略），不会被误判"未通过"。`audioMinDurationSec` 默认值 5→4。录音自动转文字（如 Web Speech API）作为后续方向记入 BACKLOG，本轮不做（跨浏览器可靠性差、e2e 假设备无法验证）。

### Changed — 富文本/图片回复、延迟送达说明（B-90, B-91）

- 用户提出"文字回复要支持富文本、可以回应图片"——记入 BACKLOG B-90 待讨论（图片存储/审核/富文本编辑器是新的产品面），本轮不做。
- 用户反馈"过了一会儿才收到、又点亮了福袋"——核对后确认是"发布即校验、延迟送达"的既定设计（demo `BW_HOLD_SECONDS=8` + 每 3 秒一次扫描），不是重复推送或计数错误，未改代码，记 BACKLOG B-91 说明。

### Added — 消息时间戳 / 回信链接 / 音频播放器补漏 / 用户名显示 / 年龄滑块（B-83~B-86）

- **年龄范围筛选滑块化**（B-83）：`Compose.tsx`「送给谁」的年龄下限/上限从两个 `<input type="number">` 换成新组件 `RangeSlider.tsx`（双滑块，推到两端代表该方向不限）。动手前用运行中的 demo 直接排障了一个用户报的疑似 bug——"标签明明匹配，筛选结果却是空"：核对候选人真实画像数据后，距离/标签在纯函数层完全匹配（直接调 `POST /api/audience/preview` 复现出 `count:1`），但只要 `ageMin`/`ageMax` 意外变成非 null（哪怕是 1），没填出生年的候选人就会被排除——这是 `user-profile` spec 早就定好且有测试覆盖的既有行为（"这些字段 MAY 留空；留空时不会被相应的受众条件命中"），不是逻辑 bug。真正的病根是原生数字输入框的上下小箭头一点就能把"空"变成"0/1"而不易察觉，滑块从交互上让这类杂散值不会再发生。
- **消息时间戳 + 回信链接原消息**（B-84）：新增 `formatTime.ts`，福袋 / 我的善意 / 祈福详情的每条消息补时间戳；`inbox-service.ts` 的 `inReplyTo` 加 `slug` 字段，`Inbox.tsx` 的"回的是你那条：「...」"改成可点链接，跳转到原信的公开落地页 `/p/:slug`（复用现成页面，不新建"查看单条消息"页）。
- **「我的善意」里的音频回应看不到播放器，只有转写文字**（B-85，真 bug）：B-71 把祈福的音频回应合并进统一的"我的善意"列表时，`OutboxItem` 没带 `contentType` / `mediaUrl`，`OutboxSection.tsx` 只渲染文字预览、完全没有 `<audio>` 元素——回应者在自己的"我的善意"里看不到、也放不了自己发出的录音。已补齐两个字段 + 播放器渲染，集成测试新增断言。
- **顶栏右上角显示用户名**（B-86）：`App.tsx` 导航栏加昵称。用户点评"显示在了菜单中间"——原来塞进 `.nav` 这个 flex 列表内部，夹在导航链接中间；改成 `.topbar` 拆两行，品牌名 + 用户名一行（两端对齐），导航链接单独一行，用户名现在贴右边界。

### Added — 内容审核 mock 开关，供开发节奏用（B-82）

用户定了一条通用开发节奏原则：功能快速迭代期，复杂判定逻辑先用可切换的简单 mock 顶上（不删旧实现，留到后面阶段再切回），保证随时有一个可用 demo。第一个落地对象是内容审核——真实三档判定（`RuleBasedProvider`）在功能还在快速迭代时容易把测试内容误挡，干扰的是别的功能验收，不是审核本身要验的东西。

- `packages/domain`：新增 `AlwaysPassProvider`（`ModerationProvider` 的另一个实现，恒 `pass`，不跑任何判定），单测覆盖 + 加入既有的"更换实现不改契约"契约测试组。
- `server/src/config/env.ts`：新增 `BW_MODERATION`（`rule_based` 默认 / `always_pass`）。
- `pnpm demo`：脚本里显式设成 `BW_MODERATION=always_pass`。
- **全局默认值没有改**——仍是 `rule_based`，跟 e2e / 单测行为一致：`content-moderation` 主 spec（已归档 P1）"审核服务不可用 MUST NOT 默认放行"是硬约束，悄悄把全局默认改成放行会跟这条 MUST 冲突，只做 demo 脚本的显式覆盖。
- `docs/DEMO.md` 补充说明 + "要看真实判定效果需要 `BW_MODERATION=rule_based pnpm demo`"的提示。

### Fixed — 拒绝时的误导性"成功"文案 + 缺失拒绝原因（B-76）

用户回应祈福被内容审核判 `violation` 后，`AudioFeedback.tsx` 标题恒显示"已发出这段祝福 ✔"，下面却同时显示"这条内容没有通过安全审核，不会送达，也没有反馈"——两句话互相矛盾。`Sent.tsx`（P1 文本祝福）有同样的问题，`rejected` 时标题仍是"已发送 ✓"。

根因：`audio-scoring-service.myFeedback()` 把"还没打完分"和"命中 violation 永远不会有分"都返回同一个 `null`——但打分管线全程同步（提交请求返回前就已经算完），实际上不存在真的"评估中"态，这个 `null` 的歧义纯粹是接口设计缺陷；也从没把具体的审核大类暴露给作者。`blessing-delivery` 主 spec 早就写了"作者侧看到大类原因"这条场景，但从没真正接到前端。

- `myFeedback` 改判别式返回：`{status:'pending'}` / `{status:'rejected', categories}` / `{status:'scored', ...}`。
- `OutboxItem` 加 `rejectionCategories: string[] | null`（`state='rejected'` 时命中的审核大类）。
- `AudioFeedback.tsx` / `Sent.tsx` 按真实结果显示对应标题 + 具体原因，不再同屏出现自相矛盾的两句话。
- 顺带修了 `OutboxSection.tsx` 把祈福回应（`scope='wish_response'`）误标成"群发 N 人"的问题，改标"回应祈福"；隐藏了这类条目不适用的"公开链接"。
- 新建 `client/src/app/moderationCategories.ts`（审核大类的中文映射，client 不依赖 domain，镜像 `packages/domain` 的 `categoryLabel`），`Moderation.tsx` 的审核台队列也用它把大类代码换成中文。
- **明确不做**：给 `auto_violation` 建审核工单——工单机制只服务于需要人工判断的场景（suspect / 举报 / 申诉），自动违规是确定性终态，不需要人工看。
- **遗留**：`blessing-delivery` spec 里"大类原因**与修改/申诉入口**"的后半句仍未实现（`edit_resubmit` 触发器从未被任何 service 调用），是 P1 归档时就有的老缺口，记 BACKLOG B-81 待讨论。

测试：`wish-request-flow.test.ts` 的"转写命中违禁词"用例改断言新判别式；`blessing-flow.test.ts` 新增 `outbox().rejectionCategories` 断言。`audio-scoring`（未归档 delta）补充"区分驳回与评估中、带审核大类"的场景。

### Changed — 审核台 / 个人空间 / 传递善意页面打磨（B-77~B-79）

- 审核台（`Moderation.tsx`）：队列为空时不再显示默认"处理理由"输入框（此前不管队列是否为空都渲染，显得莫名其妙）。
- 个人空间（`Profile.tsx`）：顶部加一句"这些信息我们不会验证真伪，但会影响别人筛选到你"；昵称 / 城市 / 性别 / 出生年从三个大卡片压缩进一个卡片的两行布局，降低信息密度过低的问题。
- 传递善意（`Compose.tsx`）：「送给谁」（受众范围）移到「场景 / 正文 / 范本」前面——这是主动发起的善意，不需要先想好场景才决定传播范围；「范本」默认折叠，点开才展开，不占开屏空间。

### Added — P2 第一批：祝福请求 + 匹配 + 音频打分（B-68, [openspec/changes/add-p2-wish-request-audio](openspec/changes/add-p2-wish-request-audio/)）

> 待用户审阅，未归档。

- **祝福请求**：登录用户写下处境/心事（必填正文）+ 可选一段稿子（供回应者朗读）+ 可选标签，发布后进入公开的**请求广场**（未登录可浏览，响应需登录）。生命周期 `pending_review → published → withdrawn/deleted`——命中安全护栏词的 `suspect` 内容先进人工复核，通过后才公开并触发匹配推送；`published` 只能撤回或删除，同 P1 撤回即终态的心智模型，不提供"重新发布"。
- **兴趣匹配推送**：请求发布（或复核通过）时，复用 `audience-service` 现成的 haversine + 标签匹配逻辑，按标签重合计算候选响应人并推送通知——请求人不选受众，是系统帮忙递给可能感兴趣的人；广场浏览和匹配推送并存，互不排斥。
- **音频祝福录制 + 实时波形**：`blessing.contentType='audio'` 从类型占位变成真正可提交路径。前端用 `MediaRecorder` + `AnalyserNode` 实现录音组件，录制过程展示实时波形（canvas），到达时长上限自动停止，可重录。P2 只做音频，视频形态继续留白推到 P3。
- **音频打分管线**（本次改动的技术重点）：转写 → （复用现成 `ModerationProvider`）安全审核 → 完整度判定（有稿子按分句字符覆盖率，无稿子复用 `isLowEffort`/`looksGarbled` 判有效表达）→ 专注度信号工程（停顿分布、语速方差、犹豫词密度，全部可解释、非黑盒）→ 真诚度/个性化评估 → 挑战式真人校验（下发随机验证词，HMAC 无状态签名，MVP 不做声纹/深伪检测——研究报告认为那是"军备竞赛"，不能当唯一闸门）。评分输出恒为**多维标签 + 置信度**，不是单一分数（vision.md 硬约束，避免变成互相比较打分的攀比场）。所有环节走可插拔接口（`AsrProvider`/`SincerityEvaluator`/`LivenessChallengePort`/`AudioStoragePort`），P2 默认接不需要真实云账号的规则实现（`RuleBasedAsrProvider` 采信客户端提供的转写文本，这个信任边界写进了代码注释；`RuleBasedSincerityEvaluator` 用字符重合度做启发式评估），同 P1 `ModerationProvider`/PGlite 的既有套路，可测、可 demo、换真实云 API 时只换驱动不换契约。
- 回应者提交后立即看到自己录音的多维反馈；请求人在"我的请求"里查看全部回应（不设数量上限）并可播放，但看不到评分细节。

### Changed — 祈福广场重构 + 导航精简（B-71，随 add-p2-wish-request-audio §9）

用户试用 P2 Demo 后要求把"祝福请求"这条线重塑成社区式的**祈福广场**，并精简导航。因为改的正是 P2 这次新做的 UI、且还没归档，所以并进同一个 change。

- **祈福广场**（`/plaza`，取代"祝福请求"页）：一条祈福（`WishRequest`）按社区 **Topic** 建模。广场列表**只给摘要 + 聚合统计**（处境摘录、标签、"已收到 N 条回应"、最后活跃时间），回应内容**点进详情页（`/plaza/:id`）才可见**。为此 `WishRequest` 加两个写入时维护的聚合字段 `responseCount` / `lastResponseAt`——在 `transitionAndPersist` 里，`wish_response` 回应进 / 出 `published` 时增量 ±1，不在列表渲染时扫 `blessings`（面向 100M 规模的正确做法，也是所有论坛的做法）。回应仍是一条 `Blessing`；独立的 `WishResponse` 实体推迟到 P3 悬赏机制明确后再引入（"采纳某条回应"= 论坛最佳答案，是它的自然落点）。
- **"我的请求" 降为筛选项**：`/plaza?filter=mine`，复用同一个列表接口，不再是独立页面 / 导航项。作者视角额外能看到 `pending_review` / `withdrawn` 的自己那几条。
- **传递善意**（`/give`，取代"写祝福"）：一页两块——上面写新祝福（原 Compose），下面"我的善意"（原发件箱 / Records，抽成 `OutboxSection` 组件）。发件箱不再是独立导航入口。
- **我的福袋**（`/pouch`，取代"收件箱"）：改名。收件箱的全部行为（`blessing-delivery`）不变；祈福的回应照旧投进福袋 + 通知（被动收到）与详情页看到（主动查看）两条路并存。
- **回响页删除**：`blessing-streak` 能力移除（连续天数、按自然日分桶都删）。个人空间底部保留一个只读的**"你已传递 N 份善意"**累计数（N = 本人 `published` + `expired` 的祝福数），只对本人可见、不可变现——并入 `user-profile`。**务实删**：`streak.ts` 纯函数模块 + `streak-service` + `/api/streak/me` 删掉；`blessing-transition` 里的 `countedInStreak` / `streakDelta` + `streak_days` 表暂留为 dormant（和 P1 状态机及其成套测试耦合，硬拆是 Runaway Refactor，留 B-74 单独清理）。
- **导航 8 → 6 项**：首页 · 祈福广场 · 传递善意 · 我的福袋 · 个人空间 · 审核台。路由 `/wish-requests*` → `/plaza*`、`/compose` → `/give`、`/inbox` → `/pouch`；旧路径不做重定向（内测期直接换）。
- 迁移 `0005_past_revanche.sql`（`wish_requests` 加两列）。openspec：`wish-request` delta 重写 + 新增 `blessing-records` / `user-profile` MODIFIED delta + `blessing-streak` REMOVED delta。`pnpm verify` 196 测试、`pnpm test:e2e` 13 个全绿。

### Fixed（P2 期间发现，随 B-68 一起交付）

- **"偶发"点「回应」跳到写祝福页**（B-72，用户 2026-09-08 走查发现）：根因不是随机——`RespondToWishRequest` / `PublishWishRequest` 在用户没同意过协议时会跳 `/agreement`，而 `Agreement.tsx` 同意后**硬编码** `nav('/compose')`，完全不管用户是从哪来的。已同意过的会话不触发，所以看着像"偶发"。修：`/agreement` 认 `?returnTo=` 查询参数（`safeReturnTo` 只放行站内相对路径，挡 `//evil.com` 这类开放重定向），两个页面跳转时带上来处，同意后回到来处，默认仍是 `/compose`。加 e2e 回归：未同意用户点「回应」→ 协议页 → 同意 → 回到 `/wish-requests/:id/respond`（而不是 `/compose`）。
- **Safari 录音全程失败**（B-69，用户 2026-09-08 Safari 走查发现）：`AudioRecorder` 当初只在系统 Chrome（e2e 假设备）上验证过，几处硬编码在 Safari 上崩且不可恢复——录完显示错误，之后即使手敲转写文字，外层"发送"按钮仍因为拿不到录音（`recorded` 为 null）永久禁用。逐条修：① 波形用的 `AudioContext` 老 Safari 只有 `webkitAudioContext`，且波形是辅助反馈、初始化失败不该阻断录音——`getAudioContextCtor()` 兜底前缀名，整个波形初始化包进独立 `try`，失败降级为无波形继续录；② `new MediaRecorder(stream)` 不传 mimeType 时 Safari 录成 `audio/mp4`，代码却把 Blob 和回放路由的 `Content-Type` 都硬编码成 `audio/webm`——`pickMimeType()` 按 `MediaRecorder.isTypeSupported` 选格式，Blob 用 `recorder.mimeType`，回放路由新增 `sniffAudioContentType()` 按文件头（EBML / `ftyp` / `OggS`）判类型；③ `recorder.start()` 不传 timeslice，Safari 有 `stop()` 丢最后一段数据的历史问题——改 `start(250)`，`onstop` 里判空录音给明确报错而不是把坏数据交上去；④ 无 `MediaRecorder` 的浏览器给"换较新浏览器"提示。新增 `audio-content-type.test.ts`（4 个，嗅探纯函数）；`blessing-audio` delta spec 补四个场景。Safari 真机复测待用户做（本机 macOS 12 装不了 Playwright webkit）。
- **一处真实安全缺口**：`wish-request-service.publish()` 最初只处理了 `violation`（拒绝）和 `pass`（直接发布），完全没处理 `suspect`——命中拉客/敛财护栏词的处境描述会直接进入公开广场（未登录都能看，比 P1 群发的收件箱曝光面更大），不会进人工复核。不是被某条 e2e 断言直接抓到的，是在排查一处不相关的测试隔离问题时回头通读 `publish()` 全部分支才发现。修法：`WishRequestState` 加 `pending_review`；`ReportRecord` 仿照 `NotificationRecord` 已有的先例，把"目标"从恒为一条祝福改成祝福或祝福请求二选一的多态；`moderation-queue-service` 按工单来源分流处理，复用同一个人工复核队列而不是新建一套；`content-moderation` 的 openspec spec 补了对应的 MODIFIED delta。
- HMAC 挑战 token 的字段分隔符最初用 `:`，和 ISO 时间戳自带的冒号冲突导致解析错位——改用 `|`。
- 犹豫词检测把"这个/那个"当成朴素子串匹配，误判"这个世界"这类正常表达——改成只在紧跟停顿标记（逗号/省略号/句末）时才计入犹豫词。
- HTTP 路由的音频提交 schema 曾把 `requestId` 定义成表单必填字段，但它其实来自 URL 参数——真实浏览器客户端从不会在表单里重复带这个字段，一直 422；手写的集成测试当年"贴心"地把它也塞进了表单数据，掩盖了这个 bug。已去掉这个冗余字段。
- 音频回应页最初没有 `Compose.tsx` 早就有的"进页面查协议同意状态 / 提交时接住 `consent_required` 跳转"逻辑，新用户会在提交时才发现自己没同意协议、且报错没有引导——补齐同款检查。

### Docs

- 回补 `add-p1-text-blessing` 的 openspec delta 并归档（B-67）：该 change 实现完成后一直没归档，中间几轮点状修复（B-61/62/63/64）都只进了 BACKLOG/CHANGELOG，从没回头改它的 spec——归档前发现 spec 描述的还是"字数下限 15""撤回可重新发布""标签只能预设"这些过时行为。用 `/opsx:update` 逐条核对代码校正 `blessing-authoring` / `blessing-delivery` / `blessing-records` 三个能力的 delta（含两个新 scenario：撤回后不能重新发布、回信关联原祝福），顺带清理 `tasks.md` 里几处过时的复核项，`validate --strict` 通过后 `/opsx:archive`——10 个能力的主 spec 现在活在 `openspec/specs/`，是当前行为的权威来源。同步刷新 `docs/product/p1-acceptance-status.md` 的测试数与受影响用例证据。
- AGENTS.md §2 新增"spec 同步检查"：动手前判断改动是否触及某个 openspec 能力已描述的行为，触及则同一轮工作里同步改 spec，不能只记 BACKLOG/CHANGELOG——防止本轮"代码改了、spec 没跟"的情况重演。

### Added

- 标签支持自定义（B-61）：个人空间画像标签、写祝福页的受众筛选标签，此前只能从建议标签里点选。后端 schema（`audienceFilterSchema` / `profileUpdateSchema`）本就是自由字符串（≤20 字，≤10/12 个），只是客户端缺输入框。`Profile.tsx` / `Compose.tsx` 各加一个文本框 + 「添加」按钮（回车也可），复用现有标签 pill 渲染。
- 回信关联原祝福（B-64）：此前"回一段祝福"只记`replyToUserId`，不记是回哪一条——收件箱消息一多，发送者分不清一条回信对应自己群发出去的哪条祝福。`Blessing` 加 `replyToBlessingId`（提交时校验：该祝福必须存在且当事人确实是其收件人之一，否则后端忽略、不关联，防止伪造）；`InboxView` 加 `inReplyTo: { blessingId, bodyPreview }`；收件箱页在回信上方展示"回的是你那条：「...」"。落到 PGlite 需要新增一列（`drizzle/0001_chunky_maria_hill.sql`）。覆盖：domain/server 集成测试（含伪造 id 被忽略的用例）+ e2e。

### Fixed

- 撤回后点「重新发布」，对方收不到但发送者以为已发出（B-63）：根因是投递扇出的幂等标记 `deliveredAt` 只在首次发布时置位、撤回时不清空——`withdrawn → verifying → published` 的重新发布路径复用了同一条记录，`deliverIfNeeded` 一看 `deliveredAt` 已经有值就直接跳过扇出，状态却正常流转到 `published`，UI 显示"已送达"。这条路径此前完全没有测试覆盖。
  处理方式：不是"清空 deliveredAt 再投一次"式的修复，而是接受"撤回即终态"——撤回后唯一出路是删除，或复制正文另发一条全新的（新 id、`deliveredAt` 从 null 开始，天然不会被旧记录的幂等标记误伤）。移除 `republish` 触发器（`packages/domain` 状态机 / 类型）、application 方法、HTTP 路由；「发出的」页对已撤回条目从"重新发布"按钮改为"复制以供编辑"（跳转到写祝福页并预填正文，不触碰旧记录）。覆盖：domain 状态机测试（撤回只剩 `delete` 一条出边）+ 2 个新集成测试（旧记录不会被复制路径污染 / 新记录正常送达）+ 1 个新 e2e（撤回后确认没有重新发布按钮、复制预填正确、旧记录仍是占位）。

### Changed

- `pnpm demo` 改用 PGlite 落盘（B-73，用户 2026-09-08 提）：之前 demo 默认走内存库，每次重启个人资料 / 请求 / 录音全清空，手动走查要反复重新登录填资料。现在 `pnpm demo` 带 `BW_DB=pglite BW_PGDATA=.pgdata`，数据落到 `server/.pgdata`（音频本就落 `server/.audio-data`），重启不丢；会话 cookie 存 userId + 30 天有效期，重启后仍是登录态。新增 `pnpm demo:fresh` 删库重来。纯内存跑法（测试用）仍在，见 DEMO.md。
- 祝福正文字数下限从 15 降到 5（B-62）：`packages/domain` `DEFAULT_CONFIG.bodyMinLen`；同步改 Compose 页提示文案与 DEMO.md 示例。上限仍是 500，`BW_BODY_MIN_LEN` 环境变量覆盖方式不变。

### Changed — P1 重定为「陌生人祝福 · 按条件群发」（B-60, [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md)）

- **模型**：P1 从"作者写给认识的人 → 生成分享链接 → 微信发给 TA"重做为"注册用户按条件群发给附近的陌生人 → 收件箱 + 通知 → 只能回一段祝福，不能对话"。原"祝福请求 / 匹配"整块移至 P2。
- **个人画像**：`user_profiles` 增经纬度（浏览器 Geolocation 或手填）、性别、出生年、标签。位置齐备才 `canBroadcast`，才被别人的受众筛选命中；对外只暴露城市 + 四舍五入到公里的距离。
- **受众筛选 + 预览**（新能力 `blessing-audience`）：距离半径 + 年龄区间 + 性别 + 标签（命中任一）。`packages/domain/src/audience.ts`（haversine + 匹配，纯函数）。`POST /api/audience/preview` 返回命中数 + 上限 + 距离最近的样本。
- **群发人数上限**：命中人数 ∈ [1, `maxAudienceSize`]（默认 10，`BW_MAX_AUDIENCE` 可调）才允许群发；0 → `audience_empty`，超上限 → `audience_too_large`。提交时定格收件人快照（`blessings.recipient_ids`），后加入 / 退出范围的人不影响。
- **投递扇出 + 收件箱**：祝福首次进入 `published` 时（`transitionAndPersist` 内），对每个快照收件人建 `inbox_items` + `notifications`，置 `delivered_at`（幂等，申诉恢复不重复）。收件箱按关联祝福**当前**状态实时渲染（撤回 / 下架 / 过期后收件箱里那条也变占位），每 3 秒自动刷新。
- **站内通知**（新能力 `notification`）：`blessing_received` + 未读数徽标（顶栏 4 秒轮询）。P1 无真实推送通道。
- **回一段祝福**：`scope=reply`，受众恒为对方一人，同样过校验。没有聊天 / 会话线程。
- **内容形态留白**：`blessings.content_type`（`text` / `audio` / `video`）+ `media` jsonb。P1 只创作 `text`，撰写页 `audio` / `video` tab 灰置"即将支持"。
- **审核目标调整**：从"宗教敛财护栏"为主改为过滤无效 / 垃圾 / 违规为主——刷屏 / 空 / 全标点 → `violation`（`low_effort`）；站外链接 / 联系方式 / 拉客敛财话术 → `suspect`（`contact_leak` / `solicitation`）；不评"写得好不好"。
- **公开链接降级**：`/p/:slug` 从"送达机制"改为"传播用"（转发带人来平台）。
- **数据层**：schema 增上述字段，新增 `notifications` 表，`inbox_items` 增 `read_at`；迁移重生成（P1 未上线，无数据迁移）；内存 + PGlite 两套实现同步更新。
- **前端**：个人空间加位置 / 性别 / 年龄 / 标签；撰写页加受众筛选 + 预览 + 形态 tab + 回复模式；新增收件箱页；顶栏通知徽标；Sent / Records / Home / Agreement 文案随之改。
- **测试**：domain `audience.test.ts`（10）+ moderation 重写；application `blessing-flow.test.ts` 与 `api-flow.test.ts` 改为多用户群发链路；`pg-repositories.test.ts` 在 PGlite 上同链路；E2E 9 个用多浏览器上下文模拟发送者 / 收件人。`pnpm verify` 绿（**137 测试**），`pnpm test:e2e` 绿（**9**），openspec `validate --strict` 通过。
- **文档**：新增 [ADR 0004](docs/adr/0004-p1-stranger-broadcast-model.md)；[use-cases.md](docs/product/use-cases.md)、[p1-architecture.md](docs/architecture/p1-architecture.md)、[concept.md](docs/product/concept.md)、[DEMO.md](docs/DEMO.md)、[p1-acceptance-status.md](docs/product/p1-acceptance-status.md)、AGENTS.md §1 同步；openspec change 的 proposal / specs 重写（新增 `blessing-audience` / `notification` 能力）。

### Fixed

- Consent gate before composing (B-50): a new user who opened 写祝福 from the nav was never routed through the agreement page — `GET /api/agreement/current` always returns 200, so Compose's consent check never fired, and submit failed with a 403 whose message was a small line at the bottom of a long form (looked like nothing happened). `AgreementView` now carries `alreadyConsented`; Compose redirects to `/agreement` on entry when it's false, and also on a `consent_required` error from submit. Covered by a new api-flow assertion and an E2E test (verified to fail without the fix).

### Changed

- 「坚持」page renamed to 「回响」(B-51): reframed around 送人玫瑰手有余香 — the cumulative count of blessings sent is the headline; the consecutive-days number is demoted to one soft line, dropping the habit-tracker pressure that clashed with the product's "不必赶" tone. Client copy only; the domain `streak` module is unchanged.
- Sent page (B-52) now states the recipient just opens the link — no registration, no login — since P1 has no in-app user→user delivery.

### Added

- Project scaffolding: README, AGENTS.md, PROMPT_LOG, ADR/product doc structure.
- OpenSpec adopted as the requirement lifecycle tool (Spec → review → TDD → implementation), see [ADR 0002](docs/adr/0002-openspec-for-requirement-lifecycle.md). Adds `openspec/` and `.claude/commands/opsx/*` + `.claude/skills/openspec-*`.
- Product vision / North Star (`docs/product/vision.md`): mission, positioning (a "focus + goodwill" space anchored to mindfulness, explicitly not a religious tool), and 5 design tie-breaker principles.
- `docs/product/concept.md` updated (v4): beachhead as a go-to-market wedge only, P1 scope locked (text-only blessings + personalization + shareable card, no AI eval, no funds), funds deferred to P3 with a licensed-custody / anti-"二清" direction, bounty framed strictly as service reward (not fundraising).
- `docs/product/capabilities.md` (v0): backend capability map — 15 domains (C1–C15) plus cross-cutting non-functionals, tagged by rollout phase; C3/C4/C9/C13 refined per research.
- `docs/research/` convention added (AGENTS.md §5, README); first report `docs/research/2026-09-01-funds-ai-licensing.md` — China funds-compliance, AI quality-evaluation, and UGC-licensing findings with an ADR checklist (ADR-A…ADR-Q).
- `docs/product/use-cases.md` (v0): P1 use cases (P1-UC-01…14), key data objects, and open questions for review.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) (Proposed): P1 tech stack — Web-first (React + TS + Vite PWA, Node + TS backend, PostgreSQL), WeChat web OAuth, pluggable `ModerationProvider`; mini-program deferred to a post-P2 decision point.
- `docs/architecture/p1-architecture.md`: P1 component view, blessing state machine, publish-then-verify / delayed-delivery model, streak rollback rules, data model, API sketch.
- openspec change `add-p1-text-blessing`: proposal + 6 capability spec deltas (wx-account, content-agreement, blessing-authoring, blessing-delivery, content-moderation, blessing-streak) + design + tasks; passes `openspec validate --strict`.
- `prototype/`: runnable P1 walkthrough spike (React PWA + pure-function domain modules) with 101 passing tests. Not production code.
- `docs/design/p1/`: P1 UI walkthrough as a Claude Design canvas (9 mobile artboards).
- `docs/product/p1-acceptance-status.md`: per-use-case status of P1 acceptance criteria against the prototype.
- `docs/architecture/` and `docs/design/` conventions added (AGENTS.md §5); `.gitignore` now ignores `node_modules/`, `dist/`.
- [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md) moved to Accepted (core items): D1 Web-first PWA, D4 Node.js+TS, D6 PostgreSQL, D10 rule-based moderation for P1; includes a long-term-fitness review.
- `docs/engineering/coding-standards.md` (v1): the technical code standard all production code must follow — layering, TypeScript, comments, API/DB conventions, concurrency & performance, security, testing, review checklist.
- Git workflow: `.claude/hooks/auto-commit-push.sh` (Stop hook) auto-commits and pushes to `main` after every turn; AGENTS.md §7 documents it.
- `coding-standards.md`: §7.1 mandates plain human-language comments (no marketing / "AI-register" phrasing); §3.1 adds architecture fitness-function tests (dependency-cruiser + `*.arch.test.ts`) as an independent suite run first in CI.
- `prototype/`: architecture tests wired up — `.dependency-cruiser.cjs` + `src/arch/architecture.arch.test.ts`, `test:arch` and `verify` scripts. `npm run verify` green (typecheck + arch + 108 tests + build).
- **P1 初版 Demo（生产 monorepo）**: `packages/domain` (pure logic) + `packages/shared` (Zod/error codes) + `server/` (Fastify, hexagonal layers, in-memory repos, scan jobs, static hosting) + `client/` (React + Vite + CSS Modules, 10 pages) + `arch/` (architecture tests). `pnpm demo` runs the whole flow single-process; `pnpm verify` green (typecheck, 0 dependency-cruiser violations, 119 tests incl. 7 `app.inject` end-to-end, build, eslint, prettier). openspec change `add-p1-text-blessing` §1–§7 implemented; `validate --strict` passes. Data layer is in-memory — PostgreSQL, real WeChat auth, real content-safety API are in BACKLOG. Walkthrough: `docs/DEMO.md`.
- `BACKLOG.md` (root): running task list + work-resume anchor. AGENTS.md / CLAUDE.md now say to read it at session start. Working method (point-by-point review iteration, parallel agents) added as AGENTS.md §8.
- PostgreSQL data layer (B-24): Drizzle schema for all 10 P1 tables (`server/src/infrastructure/db/schema.ts`), generated migration (`server/drizzle/`), and a full `Repositories` implementation against Drizzle (`server/src/infrastructure/pg/pg-repositories.ts`) sharing the same ports as the in-memory version — blessing events live in their own table and are rehydrated on read. Runs on PGlite (Postgres compiled to WASM, in-process, no local Postgres install needed); `BW_DB=pglite` selects it, in-memory stays the default. 5 integration tests run the whole application stack against real SQL, in-process, CI-safe. Swapping to a standalone Postgres in production is a one-layer driver change. Homebrew on this machine can't build Postgres (`openssl@3: unknown keyword :overwrite`), hence PGlite.
- Playwright end-to-end tests (B-30): standalone `e2e/` (own npm, not in the workspace). Drives the system-installed Chrome (`channel: 'chrome'`) because Playwright no longer ships a chromium build for macOS 12. `webServer` builds the client and starts the server with a 1-second delivery hold. 6 tests: author flow (login → profile → agreement → compose with paste blocked → sent → auto-publish → visitor sees content → withdraw → visitor sees placeholder), moderation (guardrail-word hold → queue → pass → delivered; high-risk report → takedown → appeal → restored), visitor (unknown link placeholder, no login needed), smoke. `pnpm test:e2e` runs them; not part of `pnpm verify`.
- Design canvas v2 approved (B-09).
- `docs/product/p1-acceptance-status.md` rewritten against the production monorepo (B-31): per-use-case evidence now points at real files and tests in `packages/domain` / `server/` / `client/` / `e2e/`, a new data-layer / deployment section, and a refreshed "pending your call" list (ADR 0003 accepted, openspec change awaiting archive, timing of real WeChat / moderation APIs, `prototype/` removal).
- Design review round 1 folded into spec + canvas + prototype: compose form trimmed to 3 sender fields (给谁 / 落款 / 城市), templates are reference-only (no one-click fill, body must be typed, paste blocked), an intention-setting prompt before writing; new `user-profile` capability (个人空间) pre-sets 落款 / 城市 / preferences; "我的祝福" → "收发记录" with outbox (P1) + inbox (empty state, `blessing-records` capability). openspec change now covers 8 capabilities; `openspec validate --strict` green. Prototype `npm run verify` green (108 tests). Canvas republished (v2, +个人空间 artboard).
