## REMOVED Requirements

### Requirement: 按地区自然日聚合

**Reason**: 用户点评（2026-09-09）要求精简掉"回响 / 坚持记录"。按用户所在地区自然日分桶聚合、跨时区边界处理这套复杂度，只为支撑"连续天数"，现在连续天数一并去掉，聚合逻辑没有存在理由。

**Migration**: 不再按自然日分桶。个人成长感的呈现改为一个不分日期的累计数——"累计善意数"，见 `user-profile` 新增的同名 Requirement（N = 当前 `published` 的祝福总数）。`packages/domain` 的 `streak` 模块（含日期 / 时区逻辑）整体删除。

### Requirement: 计数回撤

**Reason**: 依附于"按自然日的发布计数"，随该聚合一起移除。

**Migration**: "离开 `published` 则计数减、`expire` 不减"这条规则的核心保留了下来，迁移到 `user-profile` 的"累计善意数"Requirement，只是作用对象从"某自然日的计数"变成"用户的累计总数"。

### Requirement: 连续天数与可见性

**Reason**: "连续天数"是打卡式 / KPI 味的激励，与 vision.md"不做排行、不做攀比、不做 KPI"的调性有张力；用户点评明确要求删掉独立的"回响"页。

**Migration**: "只对作者本人可见""MUST NOT 转化为积分 / 等级 / 可变现物"这两条硬约束保留，迁移到 `user-profile` 的"累计善意数"Requirement。展示位置从独立页面（`/streak`）移到个人空间内的一个只读数字。"连续天数"这一指标不再存在。
