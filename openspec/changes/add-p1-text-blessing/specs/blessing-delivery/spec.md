## Purpose

管理一条祝福从提交到被看见的全过程：作者提交即"已发送"并拿到可分享链接，平台先校验再让接收方可见；访客免注册按祝福状态查看正文或中性占位；作者可撤回、重新发布、删除、续期。

## ADDED Requirements

### Requirement: 祝福状态机

每条祝福 MUST 处于以下状态之一：`draft`、`verifying`、`published`、`rejected`、`taken_down`、`withdrawn`、`deleted`、`expired`。状态转移 MUST 只按允许的路径发生，每次转移 MUST 记录来源状态、目标状态、触发者与原因。进入 `deleted` 后 MUST NOT 再转为其它状态。作者 SHALL 可在校验期（`verifying`）取消祝福（`verifying → withdrawn`）；取消 MUST 清除该祝福的待发布定时，使其不会在校验完成后被发布。

#### Scenario: 提交进入校验

- **WHEN** 作者提交一份草稿
- **THEN** 系统创建一条 `verifying` 状态的祝福，生成公开短链，并清理对应草稿

#### Scenario: 校验期取消

- **WHEN** 作者对一条 `verifying` 祝福执行取消
- **THEN** 祝福转为 `withdrawn`，落地页显示"已被收回"占位，且校验通过后不会被发布

#### Scenario: 非法转移被拒绝

- **WHEN** 系统尝试将一条 `deleted` 祝福转为 `published`
- **THEN** 转移被拒绝，状态保持 `deleted`

### Requirement: 发布即校验、延迟送达

作者提交后 SHALL 立即视为"已发送"（作者侧看到成功、获得可分享链接）。接收方可见性 MUST 被 hold 到自动内容合规检查给出结论：`pass` → `published`；`suspect` → 保持 `verifying` 并进入人工复核队列；`violation` → `rejected`。作者侧"已发送"状态与接收方侧"可见"状态 MUST 是两个独立状态。

#### Scenario: 自动通过后送达

- **WHEN** 一条 `verifying` 祝福的自动检查结论为 `pass`
- **THEN** 祝福转为 `published`，记录发布时间与链接有效期，接收方可见正文

#### Scenario: 校验期访客访问

- **WHEN** 访客在祝福仍为 `verifying` 时访问其公开链接
- **THEN** 系统返回"准备中"占位，MUST NOT 返回正文

#### Scenario: 自动判定违规

- **WHEN** 一条 `verifying` 祝福的自动检查结论为 `violation`
- **THEN** 祝福转为 `rejected`，作者侧看到大类原因与修改 / 申诉入口，公开链接对访客显示中性占位

#### Scenario: hold 超时

- **WHEN** 一条祝福在 `verifying` 停留超过配置的 hold 上限仍无结论
- **THEN** 系统升级处理并通知作者当前状态，祝福状态不变

### Requirement: 可分享的祝福落地页

系统 SHALL 为每条祝福生成一个公开可访问、无需登录的短链 / 落地页。落地页 MUST 按祝福状态渲染：`published` 且未过期展示正文与来源；其它状态展示对应的中性占位（准备中 / 已收回 / 已下架 / 已过期 / 未找到）。落地页 MUST NOT 暴露作者 openid、精确位置或手机号。占位文案 MUST 中性、不泄露原内容、不报技术错误。

#### Scenario: 已发布祝福的落地页

- **WHEN** 访客访问一条 `published` 且未过期祝福的链接
- **THEN** 页面展示正文、来自"[城市] 的 [昵称]"、给"[称呼]"、场景与时间

#### Scenario: 非微信浏览器打开

- **WHEN** 访客在非微信环境的普通浏览器打开分享链接
- **THEN** 页面正常展示（不依赖微信环境）

#### Scenario: 撤回后的落地页

- **WHEN** 访客访问一条已被作者撤回的祝福链接
- **THEN** 页面展示"这份祝福已被收回"的占位，不泄露原正文

### Requirement: 链接有效期与续期

每条祝福的公开链接 SHALL 有一个有效期（默认值可配置）。到期后祝福 MUST 转为 `expired`，落地页显示"分享期限已过"占位，且底层数据 MUST NOT 被删除。作者 SHALL 可对将过期或已过期的祝福续期，续期后恢复 `published` 且顺延有效期，续期 MUST NOT 重新触发内容合规检查。

#### Scenario: 链接到期

- **WHEN** 一条 `published` 祝福到达有效期
- **THEN** 祝福转为 `expired`，落地页显示"分享期限已过"占位，数据保留

#### Scenario: 作者续期

- **WHEN** 作者对一条 `expired` 祝福续期
- **THEN** 祝福恢复 `published`，有效期顺延，且不重新走内容合规检查

### Requirement: 作者管理祝福

作者 SHALL 可查看自己发布的祝福列表（时间、场景、给谁、状态）。撤回 MUST 立即停止公开访问且可恢复（重新发布需重新走校验）。删除 MUST 二次确认、按不可逆处理，删除后按数据保护要求冻结数据（停止除存储与安全外的处理），且 MUST NOT 仍出现在作者列表。撤回 / 删除 / 过期 / 下架对公开落地页的生效 MUST 在 60 秒内完成（含缓存失效）。

#### Scenario: 撤回后重新发布

- **WHEN** 作者撤回一条祝福后又重新发布
- **THEN** 祝福重新进入 `verifying`，通过校验后再次 `published`

#### Scenario: 删除的即时生效

- **WHEN** 作者确认删除一条祝福
- **THEN** 60 秒内该祝福的公开落地页不再返回正文，且不再出现在作者列表

### Requirement: 已分发副本不可追回的告知

系统 MUST 在协议或删除 / 撤回操作处事先告知作者：祝福一经送达，接收方已获得的副本（截图、转发）不因撤回 / 删除而失效。

#### Scenario: 删除时的告知

- **WHEN** 作者进入删除确认
- **THEN** 系统展示"已分发副本无法追回"的说明
