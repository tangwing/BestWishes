## Purpose

让用户知道"有人给你送了祝福"。P1 只做站内一条通知列表 + 未读数徽标；真实推送通道（微信模板消息 / Web Push）留到后续。

## ADDED Requirements

### Requirement: 收到祝福时产生通知

当一条祝福**首次投递**到某收件人的收件箱时，系统 MUST 为该收件人产生一条 `blessing_received` 通知，记录来源用户与祝福引用。通知 MUST 只在祝福进入 `published` 且完成投递时产生，MUST NOT 在校验期（`verifying`）产生。

#### Scenario: 群发通过校验后收件人收到通知

- **WHEN** 一条群发祝福通过内容校验并投递给收件人 A、B
- **THEN** A、B 各收到一条 `blessing_received` 通知，来源为发送者

#### Scenario: 申诉恢复不重复通知

- **WHEN** 一条已投递的祝福被下架后又申诉恢复
- **THEN** 收件人不会因此再收到一条新通知

### Requirement: 未读数与标记已读

系统 SHALL 提供当前用户的通知列表与未读数。用户查看收件箱 MUST 把未读通知标记为已读。

#### Scenario: 打开收件箱清未读

- **WHEN** 用户有 2 条未读通知，打开收件箱
- **THEN** 未读数变为 0
