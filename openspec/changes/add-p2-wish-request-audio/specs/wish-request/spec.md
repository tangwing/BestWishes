## Purpose

让登录用户主动发布"祝福请求"——写下自己的处境或心事、可选附一段希望别人朗读的稿子，发布后进入公开广场供人浏览响应；这是 P1"主动群发"之外的第二条互动路径：从"我送你"变成"我求你送我"。

## ADDED Requirements

### Requirement: 撰写祝福请求

登录用户 SHALL 可撰写一条祝福请求，内容包含处境 / 心事描述（必填正文）、一段可选的具体稿子（`scriptText`，供回应者朗读）、以及一组可选标签（供 `wish-request-matching` 按标签推荐候选响应人；留空表示不按标签限定）。正文长度约束与祝福正文一致（复用 `blessing-authoring` 的字数规则）。请求 MUST 先过内容安全检查（复用 `content-moderation` 的 `ModerationProvider`），判定逻辑与祝福正文一致：命中 `violation` MUST 拒绝发布；命中 `suspect` MUST NOT 直接公开或触发匹配推送，而是进入人工复核队列，通过后才正式公开（见"请求的生命周期"）；只有 `pass` 才立即公开。

#### Scenario: 附稿子发布

- **WHEN** 用户撰写请求时填写了处境描述和一段稿子
- **THEN** 系统保存两者，发布后回应者在响应页能看到这段稿子

#### Scenario: 不附稿子发布

- **WHEN** 用户只填写处境描述，不提供稿子
- **THEN** 系统正常发布，回应者只看到处境描述，自由发挥响应内容

#### Scenario: 请求内容命中违规

- **WHEN** 一条请求的处境描述或稿子命中内容安全检查的 `violation`
- **THEN** 请求被拒绝发布，作者看到拒绝原因

#### Scenario: 请求内容命中疑似

- **WHEN** 一条请求的处境描述命中内容安全检查的 `suspect`（如拉客 / 敛财话术）
- **THEN** 请求进入 `pending_review`，不出现在广场，不触发候选人匹配推送；同一条工单出现在人工复核队列（复用 `content-moderation` 的统一队列，不新建一套）

### Requirement: 请求广场

系统 SHALL 提供一个公开的请求广场，列出所有 `published` 状态的祝福请求（不需要登录即可浏览标题级信息；响应操作 MUST 要求登录）。广场 SHALL 按发布时间倒序分页展示。

#### Scenario: 浏览广场

- **WHEN** 用户打开请求广场
- **THEN** 看到当前公开的祝福请求列表，按最新发布排在前面

#### Scenario: 未登录浏览广场

- **WHEN** 未登录访客打开请求广场
- **THEN** 可以看到列表内容，但尝试响应时被引导先登录

### Requirement: 请求的生命周期

请求 MUST 处于 `pending_review`、`published`、`withdrawn`、`deleted` 四态之一。命中疑似的请求 MUST 先进入 `pending_review`，人工复核通过后才转为 `published`（此时才计算候选响应人快照并触发匹配推送——不能在还没公开时就推给别人）；人工驳回则直接进 `deleted`，不经过 `published`。`pending_review` MUST NOT 提供撤回操作（还没公开，没有可撤回的曝光）。撤回（仅对 `published` 有效）MUST 立即从广场移除且 MUST 是终态——不提供"重新发布"操作，作者若想再发一次相近的请求，只能复制内容另发一条新的（与 `blessing-delivery` 的撤回规则保持一致的心智模型）。删除 MUST 二次确认、不可逆，且不影响已经收到的回应（回应作为独立的 `Blessing` 记录，不因请求被删除而消失）。

#### Scenario: 撤回后从广场消失

- **WHEN** 作者撤回一条请求
- **THEN** 该请求不再出现在广场，未响应过的人也无法再对它响应

#### Scenario: 删除不影响已有回应

- **WHEN** 作者删除一条已经收到几条回应的请求
- **THEN** 这些回应仍然保留在作者的收件箱里，不受影响

#### Scenario: 人工复核通过后才公开与匹配

- **WHEN** 一条 `pending_review` 的请求被人工复核通过
- **THEN** 请求转为 `published`、出现在广场，此时才计算候选响应人并推送匹配通知

#### Scenario: 人工驳回直接终态

- **WHEN** 一条 `pending_review` 的请求被人工复核驳回
- **THEN** 请求转为 `deleted`，从未出现在广场，作者无法再对它做任何操作

### Requirement: 查看收到的回应

请求作者 SHALL 可查看自己某条请求收到的全部回应（不设数量上限，全部列出，按时间倒序），每条回应包含回应者的粗粒度信息（昵称、城市，规则同 `blessing-authoring` 的"发送者信息来自画像"）与回应内容。

#### Scenario: 查看全部回应

- **WHEN** 作者打开一条请求的回应列表
- **THEN** 看到该请求收到的所有回应，不受数量限制
