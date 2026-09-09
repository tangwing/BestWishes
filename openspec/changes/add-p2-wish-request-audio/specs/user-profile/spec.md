## MODIFIED Requirements

### Requirement: 账户管理

个人空间 SHALL 提供退出登录。账户注销 SHALL 可发起（P1 可先走人工 / 占位流程），发起后系统按数据保护要求处理该用户数据。

#### Scenario: 退出登录

- **WHEN** 用户在个人空间点击退出
- **THEN** 系统清除登录态，回到未登录首页

## ADDED Requirements

### Requirement: 累计善意数

个人空间 SHALL 向用户本人展示一个"你已传递 N 份善意"的累计数字，N 为该用户处于 `published` 或 `expired` 状态的祝福总数（`expired` 也计入——作者当时确实完成了这份善意，只是链接到期；不分自然日、不计连续天数）。这个数字 MUST 只对用户本人可见，MUST NOT 提供给其他用户或访客，MUST NOT 被转化为积分、等级、排行或任何可变现物。

当一条祝福因作者撤回、作者删除或平台下架离开 `published`，N MUST 相应减少；链接过期（`expire`）MUST NOT 使 N 减少（作者当时确实完成了这份善意）。

#### Scenario: 本人可见

- **WHEN** 用户打开个人空间
- **THEN** 看到"你已传递 N 份善意"，N 等于自己 `published` + `expired` 的祝福数（撤回 / 删除 / 下架的不计）

#### Scenario: 他人不可见

- **WHEN** 其他用户或访客尝试获取某用户的累计善意数
- **THEN** 系统不提供该数据

#### Scenario: 撤回后回落

- **WHEN** 用户撤回一条已发布的祝福
- **THEN** 个人空间的累计善意数减 1

#### Scenario: 过期不回落

- **WHEN** 用户一条已发布祝福因到达链接有效期转为 `expired`
- **THEN** 累计善意数不变
