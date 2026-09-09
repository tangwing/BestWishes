## Purpose

让登录用户主动发布"祝福请求"（下称**祈福**）——写下自己的处境或心事、可选附一段希望别人朗读的稿子，发布后进入公开的**祈福广场**。祈福按社区 **Topic** 的方式建模：广场列表只给摘要 + 聚合统计，回应内容点进详情页才可见。这是 P1"主动群发"之外的第二条互动路径：从"我送你"变成"我求你送我"。

## ADDED Requirements

### Requirement: 撰写祈福

登录用户 SHALL 可撰写一条祈福，内容包含处境 / 心事描述（必填正文）、一段可选的具体稿子（`scriptText`，供回应者朗读）、以及一组可选标签（供 `wish-request-matching` 按标签推荐候选响应人；留空表示不按标签限定）。正文长度约束与祝福正文一致（复用 `blessing-authoring` 的字数规则）。祈福 MUST 先过内容安全检查（复用 `content-moderation` 的 `ModerationProvider`），判定逻辑与祝福正文一致：命中 `violation` MUST 拒绝发布；命中 `suspect` MUST NOT 直接公开或触发匹配推送，而是进入人工复核队列，通过后才正式公开（见"祈福的生命周期"）；只有 `pass` 才立即公开。

#### Scenario: 附稿子发布

- **WHEN** 用户撰写祈福时填写了处境描述和一段稿子
- **THEN** 系统保存两者，发布后回应者在响应页能看到这段稿子

#### Scenario: 不附稿子发布

- **WHEN** 用户只填写处境描述，不提供稿子
- **THEN** 系统正常发布，回应者只看到处境描述，自由发挥响应内容

#### Scenario: 祈福内容命中违规

- **WHEN** 一条祈福的处境描述或稿子命中内容安全检查的 `violation`
- **THEN** 祈福被拒绝发布，作者看到拒绝原因

#### Scenario: 祈福内容命中疑似

- **WHEN** 一条祈福的处境描述命中内容安全检查的 `suspect`（如拉客 / 敛财话术）
- **THEN** 祈福进入 `pending_review`，不出现在广场，不触发候选人匹配推送；同一条工单出现在人工复核队列（复用 `content-moderation` 的统一队列，不新建一套）

### Requirement: 祈福广场列表

系统 SHALL 提供一个公开的祈福广场，列出所有 `published` 状态的祈福（不需要登录即可浏览；响应操作 MUST 要求登录）。广场列表 SHALL 按发布时间倒序分页。

广场列表的每一项 MUST 只包含**摘要级信息**：祈福作者的粗粒度信息（昵称、城市）、处境描述（可截断）、标签、以及聚合统计（见"回应数聚合统计"）。列表项 MUST NOT 包含任何回应的正文、音频链接或回应者身份——这些只在祈福详情页（见"查看祈福详情"）返回。

#### Scenario: 浏览广场

- **WHEN** 用户打开祈福广场
- **THEN** 看到当前公开的祈福列表，按最新发布排在前面，每项显示处境摘要、标签、"已收到 N 条回应"

#### Scenario: 未登录浏览广场

- **WHEN** 未登录访客打开祈福广场
- **THEN** 可以看到列表内容，但尝试响应时被引导先登录

#### Scenario: 列表不泄露回应内容

- **WHEN** 一条祈福已经收到若干条回应，任何人打开广场列表
- **THEN** 列表项只显示回应**数量**，不包含任何一条回应的正文、音频 URL 或回应者昵称

### Requirement: 我的祈福筛选

祈福广场 SHALL 支持一个"只看我发布的"筛选（例如 `?filter=mine`），复用同一个列表接口，不是独立页面。启用该筛选时，作者 SHALL 额外看到自己处于 `pending_review`、`withdrawn` 状态的祈福（广场默认视图只列 `published`）。

#### Scenario: 切换到我的祈福

- **WHEN** 登录用户在广场切换到"我的祈福"筛选
- **THEN** 列表只显示该用户发布的祈福，包含尚在人工复核中和已撤回的

#### Scenario: 我的祈福不影响他人视图

- **WHEN** 用户 A 查看"我的祈福"，用户 B 查看默认广场
- **THEN** B 看到的仍是全部 `published` 祈福，不受 A 的筛选影响

### Requirement: 回应数聚合统计

每条祈福 MUST 维护两个聚合字段：`responseCount`（当前处于 `published` 的回应条数）与 `lastResponseAt`（最近一条回应发布的时间）。这两个字段 MUST 在回应进入 / 离开 `published` 状态时增量维护，MUST NOT 依赖在广场列表渲染时对全部回应做实时计数。

一条回应进入 `published` 时，对应祈福的 `responseCount` MUST `+1`，`lastResponseAt` MUST 刷新为该时间。一条回应因撤回 / 平台下架 / 删除离开 `published` 时，`responseCount` MUST `-1`（下限为 0）；`lastResponseAt` MAY 保持不变（"最后活跃时间"是软信号）。

#### Scenario: 新回应发布后计数增加

- **WHEN** 一条针对某祈福的音频回应通过打分与审核、进入 `published`
- **THEN** 该祈福的 `responseCount` 加 1，`lastResponseAt` 更新为当前时间，广场列表随即显示新的回应数

#### Scenario: 回应撤回后计数回落

- **WHEN** 一条已发布的回应被其作者撤回
- **THEN** 对应祈福的 `responseCount` 减 1

#### Scenario: 计数与实际一致

- **WHEN** 对任意一条祈福，统计其当前 `state='published'` 的 `wish_response` 回应条数
- **THEN** 该数量与祈福记录上的 `responseCount` 相等

### Requirement: 查看祈福详情

系统 SHALL 提供祈福详情视图。详情 SHALL 返回祈福的处境描述全文、可选稿子、标签、聚合统计，以及该祈福收到的全部 `published` 回应（不设数量上限，按时间倒序），每条回应包含回应者的粗粒度信息（昵称、城市，规则同 `blessing-authoring` 的"发送者信息来自画像"）与回应内容（音频链接 + 转写）。未过审 / 已撤回的回应 MUST NOT 出现在详情里。

回应内容 MUST 只在详情视图返回，MUST NOT 出现在广场列表。祈福作者与其他登录用户看到的回应集合一致（都是 `published` 的那些）；回应者的多维评分细节 MUST NOT 对任何人在此暴露（见 `audio-scoring` 的"请求人看到的反馈"）。

#### Scenario: 点进详情看到回应

- **WHEN** 用户在广场点开一条已收到 3 条回应的祈福
- **THEN** 详情页展示处境全文、稿子，以及这 3 条回应的音频与转写，可逐条播放

#### Scenario: 详情不含评分细节

- **WHEN** 祈福作者查看自己某条祈福的详情
- **THEN** 看到每条回应的内容，但看不到回应者的完整度 / 专注度 / 真诚度标签

#### Scenario: 撤回的回应不出现在详情

- **WHEN** 某条回应被作者撤回后，任何人打开该祈福详情
- **THEN** 这条回应不在列表中，`responseCount` 也已相应减少

### Requirement: 祈福的生命周期

祈福 MUST 处于 `pending_review`、`published`、`withdrawn`、`deleted` 四态之一。命中疑似的祈福 MUST 先进入 `pending_review`，人工复核通过后才转为 `published`（此时才计算候选响应人快照并触发匹配推送——不能在还没公开时就推给别人）；人工驳回则直接进 `deleted`，不经过 `published`。`pending_review` MUST NOT 提供撤回操作（还没公开，没有可撤回的曝光）。撤回（仅对 `published` 有效）MUST 立即从广场移除且 MUST 是终态——不提供"重新发布"操作，作者若想再发一次相近的祈福，只能复制内容另发一条新的（与 `blessing-delivery` 的撤回规则保持一致的心智模型）。删除 MUST 二次确认、不可逆，且不影响已经收到的回应（回应作为独立的 `Blessing` 记录，不因祈福被删除而消失）。

#### Scenario: 撤回后从广场消失

- **WHEN** 作者撤回一条祈福
- **THEN** 该祈福不再出现在广场，未响应过的人也无法再对它响应

#### Scenario: 删除不影响已有回应

- **WHEN** 作者删除一条已经收到几条回应的祈福
- **THEN** 这些回应仍然保留在回应者与作者的记录里，不受影响

#### Scenario: 人工复核通过后才公开与匹配

- **WHEN** 一条 `pending_review` 的祈福被人工复核通过
- **THEN** 祈福转为 `published`、出现在广场，此时才计算候选响应人并推送匹配通知

#### Scenario: 人工驳回直接终态

- **WHEN** 一条 `pending_review` 的祈福被人工复核驳回
- **THEN** 祈福转为 `deleted`，从未出现在广场，作者无法再对它做任何操作

### Requirement: 回应投递到福袋

一条针对祈福的回应进入 `published` 时，除了计入祈福详情，系统 SHALL 同时把它投递进祈福作者的**福袋**（复用 `blessing-delivery` 的收件箱机制）并产生一条通知（复用 `notification`）。作者因此既能在福袋被动收到回应，也能在祈福详情主动查看全部回应——两条路并存。

#### Scenario: 回应同时进福袋和详情

- **WHEN** 一条音频回应通过审核进入 `published`
- **THEN** 祈福作者的福袋新增一条、未读数加 1，同一条回应也出现在该祈福的详情列表里
