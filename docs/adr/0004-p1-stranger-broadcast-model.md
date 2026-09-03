# 4. P1 改为「面向陌生人的按条件群发」模型

日期：2026-09-04

## 状态

Accepted

## 背景

P1 初版（见 [ADR 0003](0003-p1-tech-stack-web-first.md)、openspec change `add-p1-text-blessing`）把祝福做成了「作者写给一个认识的人 → 生成分享链接 → 通过微信把链接发给 TA」。

走查中发现这与产品意图有偏差：

- BestWishes 是一个**陌生人之间**的善意平台。你不需要认识一个人，才能给 TA 送祝福。
- 「通过微信」指的是**产品自身的传播**（把平台分享给朋友），不是把某条祝福点对点发给特定的人。
- 缺少"收到祝福"的一侧：老模型里收件箱是空的，接收方只是一个打开链接的匿名访客。

## 决策

P1 重做为：

1. **用户画像**：每个注册用户有唯一账号 + 自报画像——昵称 / 落款、城市、**经纬度位置**、性别、出生年、**标签**。画像用于"被别人的受众筛选命中"。

2. **按条件群发**：发送者写一段祝福，选一个**受众筛选**——以自己位置为圆心的**距离半径** + 年龄区间 + 性别 + 标签（命中任一）。

3. **人数上限**：筛选命中的人数必须 **≤ 配置上限**（`maxAudienceSize`，测试期 10）才允许群发；超过则拒绝，要求缩小范围。命中 0 也不可发。发送前提供**受众预览**（人数 + 距离最近的几位）。

4. **收件箱 + 通知**：命中的人在**收件箱**收到这段祝福，并收到**站内通知**（未读徽标）。祝福先过内容校验（发布即校验 / 延迟送达不变），通过后才投递并通知。收件人列表在提交时**定格**（快照），之后加入 / 退出范围的人不影响。

5. **不能对话，只能回祝福**：收件人对一条收到的祝福，只能"**回一段祝福**"（`scope=reply`，受众恒为对方一人，同样过校验）。没有聊天、没有会话线程。

6. **内容形态留白**：祝福有 `contentType`（`text` / `audio` / `video`）。P1 只创作 `text`；类型、`media` 字段、UI 的禁用 tab 已就位，音视频功能待 P2。

7. **审核目标调整**：从"宗教敛财护栏"为主，改为**过滤无效 / 垃圾 / 违规信息**为主——刷屏 / 空内容 / 乱码判 violation；站外导流（链接 / 联系方式）/ 拉客敛财话术判 suspect 进人工队列；明显违法违禁判 violation。不评判"祝福写得好不好"（那是 P2 的 AI 用心反馈）。

8. **公开链接降级为传播用**：每条祝福仍有 `/p/:slug` 公开页（按状态渲染正文 / 占位，可举报），但它的用途是"把这条祝福转发出去、带更多人来平台"，**不再是送达机制**。

## 不变的部分

- 技术栈（ADR 0003）：Web-first PWA + Node/Fastify + PostgreSQL（Drizzle / PGlite）+ pnpm monorepo，领域逻辑在 `packages/domain`。
- 祝福状态机、发布即校验 / 延迟送达、坚持记录（"回响"）及其回撤规则、审核三档判定 + 人工队列、举报合并 + 高危即时下架。
- 微信网页授权、真实内容安全 API 仍是可替换接口，P1 用 stub / 规则实现。

## 移出 P1（推迟）

- **祝福请求 / 匹配 / 推荐**：老 concept 里的"发布祝福请求 → 响应请求"整块推迟到 P2（随音视频 + AI 反馈）。P1 只有"主动群发"和"回一段祝福"两个动作。
- 真实定位逆地理编码（P1 存经纬度 + 手填城市；浏览器 Geolocation 已接，逆地理编码待接）。
- 真实推送通道（微信模板消息 / Web Push）——P1 只有站内通知列表 + 未读数。
- 距离筛选的空间索引（P1 用 bounding-box 预筛 + haversine，用户量小足够；PostGIS / 分片待有真实负载再谈）。

## 影响

- 领域层新增 `audience.ts`（haversine + 匹配）；`Blessing` 增 `contentType` / `media` / `scope` / `audience` / `replyToUserId` / `recipientIds` / `deliveredAt`；moderation 词表与规则重写。
- 数据层：`user_profiles` 增 `lat` / `lng` / `gender` / `birth_year` / `tags`；`blessings` 增上述字段；新增 `notifications` 表；`inbox_items` 增 `read_at`。迁移已重生成（P1 未上线，无数据迁移）。
- 应用层新增 `AudienceService` / `InboxService` / `NotificationService`；`BlessingService.submit` 重写；投递扇出在状态转移到 `published` 时触发（幂等靠 `deliveredAt`）。
- 前端：个人空间加位置 / 性别 / 年龄 / 标签；撰写页加受众筛选 + 预览 + 形态 tab + 回复模式；新增收件箱页 + 通知徽标。
- openspec change `add-p1-text-blessing` 的 proposal / specs 相应更新（`blessing-audience` / `blessing-inbox` / `notification` 为新增能力；`blessing-authoring` / `blessing-delivery` / `blessing-records` / `content-moderation` / `content-agreement` / `user-profile` 修改）。
