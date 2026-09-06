## ADDED Requirements

### Requirement: 请求匹配通知

当 `wish-request-matching` 为一条祝福请求算出候选响应人时，系统 SHALL 为每个候选人产生一条 `wish_request_matched` 通知，记录关联的请求引用。此类通知复用现有的通知列表与未读数机制（见"未读数与标记已读"），不改变其结构性行为。

#### Scenario: 候选人收到匹配通知

- **WHEN** 一条祝福请求匹配到某候选响应人
- **THEN** 该用户收到一条 `wish_request_matched` 通知，未读数增加，可在通知列表里看到

#### Scenario: 与祝福通知共享同一套未读机制

- **WHEN** 用户同时有未读的 `blessing_received` 和 `wish_request_matched` 通知
- **THEN** 两者共同计入同一个未读数，标记已读的操作对两者一视同仁
