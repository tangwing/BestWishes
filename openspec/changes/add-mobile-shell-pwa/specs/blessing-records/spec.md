## MODIFIED Requirements

### Requirement: 收件箱入口

主导航 SHALL 有一个指向用户收到的祝福的入口，展示名为**"我的福袋"**，带未读徽标（未读数来自 `notification`）。该入口在具体端上的位置由 `mobile-shell` 定义（移动端为底部导航），本要求 MUST NOT 绑定某个具体位置。该入口打开的页面即 `blessing-delivery` 定义的收件箱，其渲染规则（按关联祝福当前状态展示正文或中性占位、定期自动刷新）不变。

#### Scenario: 有未读时的徽标

- **WHEN** 用户收到一条新祝福或一条祈福回应、还没打开福袋
- **THEN** 主导航的"我的福袋"入口显示未读数徽标

#### Scenario: 福袋内容

- **WHEN** 用户打开"我的福袋"
- **THEN** 看到陌生人送来的祝福，以及自己发布的祈福收到的回应，按 `blessing-delivery` 的规则渲染
