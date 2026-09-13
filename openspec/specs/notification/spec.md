# Notification Specification

## Purpose

让用户知道"有人给你送了祝福"。P1 只做站内一条通知列表 + 未读数徽标；真实推送通道（微信模板消息 / Web Push）留到后续。

## Requirements

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

### Requirement: 请求匹配通知

当 `wish-request-matching` 为一条祝福请求算出候选响应人时，系统 SHALL 为每个候选人产生一条 `wish_request_matched` 通知，记录关联的请求引用。此类通知复用现有的通知列表与未读数机制（见"未读数与标记已读"），不改变其结构性行为。

#### Scenario: 候选人收到匹配通知

- **WHEN** 一条祝福请求匹配到某候选响应人
- **THEN** 该用户收到一条 `wish_request_matched` 通知，未读数增加，可在通知列表里看到

#### Scenario: 与祝福通知共享同一套未读机制

- **WHEN** 用户同时有未读的 `blessing_received` 和 `wish_request_matched` 通知
- **THEN** 两者共同计入同一个未读数，标记已读的操作对两者一视同仁
