# P1 架构设计（陌生人祝福 · 按条件群发）

> 状态：v1，2026-09-04（按 [ADR 0004](../adr/0004-p1-stranger-broadcast-model.md) 重写）。依据 [use-cases.md](../product/use-cases.md)、[ADR 0003](../adr/0003-p1-tech-stack-web-first.md)、[ADR 0004](../adr/0004-p1-stranger-broadcast-model.md)。

## 1. 范围

只覆盖 P1：微信登录、个人画像（位置 / 性别 / 出生年 / 标签）、授权协议、范本库、撰写文本祝福、草稿、**受众筛选 + 预览**、**按条件群发**（人数上限约束）、自动内容合规检查、"发布即校验、延迟送达"、**收件箱 + 站内通知**、**回一段祝福**、公开链接（传播用）+ 访客查看、发件箱管理（撤回 / 重发 / 删除 / 续期）、回响（原坚持记录）、举报、审核队列。

**不在 P1**：语音 / 视频祝福（`contentType` 留白）、AI 用心评估、祝福请求 / 匹配 / 推荐、悬赏与资金、逆地理编码、真实推送通道、合成视频、原生 App、距离查询的空间索引。

## 2. 组件视图

```
┌─────────────────────────────────────────────────────────┐
│  Web 前端 (React + TS + Vite, PWA)                        │
│  - 发送者：登录 → 画像(位置/标签) → 协议 → 撰写 →         │
│            受众筛选 + 预览 → 群发 → 校验中                │
│  - 收件人：收件箱（按状态渲染）+ 通知徽标 + 回一段祝福   │
│  - 访客：公开链接落地页（传播用）+ 举报                  │
│  - 审核台（P1 用最简页面）                               │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP/JSON
┌───────────────┴─────────────────────────────────────────┐
│  后端 API (Node + TS + Fastify)  —— 分层 interface/       │
│  application/infrastructure/ports                         │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ auth   │ │ profile  │ │ audience │ │ blessing      │  │
│  │        │ │(画像)    │ │(受众解析)│ │(状态机 + 提交)│  │
│  └────────┘ └──────────┘ └────┬─────┘ └──────┬────────┘  │
│  ┌────────┐ ┌──────────┐      │              │           │
│  │consent │ │ inbox    │      │   ┌──────────┴────────┐  │
│  │        │ │notif.    │      │   │ 投递扇出 (deliver) │  │
│  └────────┘ └──────────┘      │   │ 到 published 时触发│  │
│  ┌────────┐ ┌──────────┐      │   │ 幂等: deliveredAt  │  │
│  │streak  │ │moderation│  ┌───┴───┴───────────────────┐ │
│  │(回响)  │ │(队列)    │  │ ModerationProvider (接口)  │ │
│  └────────┘ └──────────┘  │  RuleBased(P1) / Cloud(后) │ │
│                           │ AudienceMatch: haversine   │ │
│                           │  (packages/domain)         │ │
│                           └────────────────────────────┘ │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────┴───────────────┐  ┌────────────────────────┐
│  PostgreSQL (Drizzle / PGlite) │  │ 定时任务               │
│  users / user_profiles /       │  │ - hold 到点发布 + 扇出 │
│  blessings / blessing_events / │  │ - 到期转 expired       │
│  consents / reports /          │  │ - hold 超时升级        │
│  streak_days / inbox_items /   │  └────────────────────────┘
│  notifications / templates     │
└────────────────────────────────┘
```

受众距离筛选 P1 用**全表扫描 + haversine**（`packages/domain/src/audience.ts`），用户量小足够；
有真实负载后再上 bounding-box 预筛 / PostGIS / 分片。

## 3. 领域核心：祝福状态机

祝福（Blessing）是 P1 的中心聚合。**作者侧状态**与**接收方可见性**是两个维度：

| 状态 | 含义 | 作者可见 | 访客落地页展示 |
|---|---|---|---|
| `draft` | 草稿 | 是（我的草稿） | —（无链接） |
| `verifying` | 已提交，平台校验中（hold） | "已发送・审核中" | "祝福正在准备中" 占位 |
| `published` | 校验通过，正式送达 | "已送达" | 正文卡片 |
| `rejected` | 自动检查判"明确违规" | "未通过・可修改/申诉" | 中性占位 |
| `taken_down` | 人工复核/举报下架 | "已下架・可申诉" | 中性占位 |
| `withdrawn` | 作者撤回（可恢复） | "已撤回・可重新发布" | "这份祝福已被收回" 占位 |
| `deleted` | 作者删除（不可逆，数据冻结） | 不在列表 | "这份祝福已被收回" 占位 |
| `expired` | 链接有效期已过 | "已过期・可续期" | "分享期限已过" 占位 |

**允许的转移**：

```
draft ──submit──▶ verifying
verifying ──auto_pass / review_pass──▶ published
verifying ──auto_violation / review_reject──▶ rejected
verifying ──withdraw──▶ withdrawn      (作者在校验期取消；清除待发布定时)
verifying ──hold_timeout──▶ (escalate, 停留 verifying + 告警)
published ──review_takedown / report_takedown──▶ taken_down
published ──withdraw──▶ withdrawn
published ──expire──▶ expired
withdrawn ──republish──▶ verifying   (重新走校验)
expired ──renew──▶ published          (未改内容，不重新校验；仅顺延有效期)
rejected ──edit_resubmit──▶ verifying
taken_down ──appeal_success──▶ published
{published, withdrawn, expired, rejected, taken_down} ──delete──▶ deleted
```

**不变量**：
- 只有 `published` 且未过期的祝福，访客落地页才返回正文。
- `verifying` / `rejected` 时，链接可以已存在（作者已"发送"），但内容不可见。
- 进入 `deleted` 后不可再转其它状态；数据按 PIPL 冻结（停止除存储与安全外的处理）。
- 坚持记录计入"曾进入 `published` 且未被作者收回 / 平台下架"的祝福；撤回 / 删除 / 下架即时回撤，**链接过期不回撤**（见 §5）。

状态机实现为纯函数模块 `blessing/lifecycle`，不依赖框架、不做 IO，便于单测与跨端复用（ADR 0003 §Consequences）。

## 4. 受众解析与群发

1. 发送者在撰写页设 `AudienceFilter { radiusKm, ageMin, ageMax, gender, tags }`。
2. `POST /api/audience/preview`：以发送者经纬度为圆心，对**所有设了经纬度的用户画像**跑
   `resolveAudience`（`packages/domain/src/audience.ts`：haversine 距离 + 年龄 + 性别 + 标签"命中任一"），
   排除自己，按距离升序。返回 `{ count, cap, canSend, sample[] }`。
3. `POST /api/blessings`（`scope=broadcast`）：重跑解析 →
   - 命中 0 → `audience_empty`；命中 > `cap`（`maxAudienceSize`，默认 10）→ `audience_too_large`；
   - 否则把命中的 userId 列表**定格**写进 `blessings.recipient_ids`（快照）。
4. `scope=reply`：忽略筛选，`recipient_ids = [replyToUserId]`，`audience` 存一个退化值。

## 4b. "发布即校验、延迟送达" + 投递扇出

1. `submit` → 创建 Blessing（`verifying`）、生成公开 slug、清草稿。发送者端立即"已发送"。
2. 同步调用 `ModerationProvider.check({ text })`：
   - `pass` → 设 `hold_until = now + holdSeconds`，停留 `verifying`。
   - `suspect` → 停留 `verifying`，建 `auto_suspect` 工单进队列。
   - `violation` → `verifying → rejected`。
   - `unavailable` → 保守：维持 hold + 进队列。
3. 定时任务 `publishReady`：`hold_until` 到点且无 open 工单的 `verifying` → `auto_pass → published`。
4. **投递扇出**：任何转移使祝福**首次**进入 `published` 时（`transitionAndPersist` 内），对
   `recipient_ids` 每人建一条 `inbox_items` + 一条 `notifications`，然后置 `delivered_at`。
   `delivered_at` 作幂等标记——`taken_down → published`（申诉恢复）不重复投递。
5. `hold_timeout`（默认 24h）仍无结论 → 升级标记，状态不变。
6. 发送者可在校验期 `withdraw` → `withdrawn`，清 hold + 关联工单。

真实云审核 API 接入后改为异步 + 回调，收件箱 / 公开页的"准备中"占位已为异步留好位。

## 5. 回响（原"坚持记录" / streak）

- `streak_days(user_id, local_date, count)`：按作者所在地区自然日聚合"该日进入 `published` 的祝福数"。
- 祝福首次 `→ published` 时：对应 `local_date` 的 `count += 1`，并在该祝福上标记 `counted = true`。
- 祝福因 **`withdraw` / `delete` / `taken_down`**（作者收回或平台下架）离开时：若 `counted`，对应 `local_date` 的 `count -= 1`、清 `counted`；`count` 归零则该日不再计入连续。
- **`expire`（链接过期）不回撤计数**——作者那天确实完成了这份祝福（2026-09-02 用户确认）。过期后再 `delete` 仍按发布日回撤。
- `expired → published`（续期）时：**不**重新加计数（`counted` 一直为 true）；续期只顺延链接有效期。
- 连续天数 = 从今天（今天无记录则从昨天，给"今天还没写"留一天宽限）往回数、`count > 0` 未中断的天数。
- 仅作者本人可见；不转积分/等级/可变现物。

## 6. 内容审核与人工复核

- `ModerationProvider` 接口：
  ```ts
  interface ModerationProvider {
    check(input: { text: string; occasion?: Occasion }):
      Promise<{ verdict: 'pass' | 'suspect' | 'violation'; categories: ModerationCategory[]; providerRef?: string; unavailable?: boolean }>;
  }
  ```
- `RuleBasedProvider`（P1）——目标是**过滤无效 / 垃圾 / 违规**，不评"写得好不好"：
  - 违禁 / 敏感关键词（涉政、色情、仇恨、诈骗、违法）→ `violation`。
  - 明显无效内容：刷屏（同字符）/ 空 / 全标点 → `violation`（`low_effort`）。
  - 站外导流（链接、手机号、微信 / QQ 号、"扫码付款""点链接领取"）→ `suspect`（`contact_leak`）。
  - 拉客 / 敛财话术（"加我微信收费""超度收费""宗教服务费"…）→ `suspect`（`solicitation`，配置可升 `violation`）。
  - 长度越界 / 乱码占比高 → `suspect`。
  - 无命中 → `pass`。
- 复核工单 `reports`（统一表，来源 = 举报 / 自动疑似 / 申诉）：
  - 字段：目标祝福、来源、大类、状态（open / in_review / resolved_pass / resolved_takedown / resolved_edit）、处理人、理由、时间线。
  - 优先级排序：高危举报 > 用户申诉 > 自动疑似 > 随机抽检。
  - 审核动作：`review_pass` / `review_reject` / `review_takedown` / `request_edit`，每个动作都留痕并触发对祝福状态机的转移。
- 举报：匿名可提交，记录防滥用信息（IP/设备指纹/频率）；同人对同祝福合并计数；高危大类触发即时 `published → taken_down`（待复核）。

## 7. 数据模型（P1，PostgreSQL）

> 落地：Drizzle schema `server/src/infrastructure/db/schema.ts`，迁移在 `server/drizzle/`。
> 开发 / 测试 / 演示跑在 PGlite（Postgres 编译成 WASM，进程内），生产换独立 Postgres 只需换
> `drizzle-orm` 驱动一层。`blessing_events` 单独一表，读祝福时拼回 `events` 数组。
> `users` 多一列 `utc_offset_minutes`（坚持记录按作者地区切自然日）。

```
users
  id, wx_openid (uniq), wx_unionid, nickname, avatar_url,
  utc_offset_minutes, source, created_at

user_profiles        -- 个人画像：显示默认值 + 受众匹配用画像
  user_id (pk/fk), sender_name (落款), region_city,
  lat (nullable), lng (nullable),           -- 受众距离筛选；两者都有才参与匹配
  gender (nullable), birth_year (nullable),
  tags (jsonb string[]),                     -- 被别人的受众筛选命中
  location_granted (bool), featured_by_default (bool, nullable), updated_at

consents
  id, user_id, agreement_version, scope_deliver, scope_featured, scope_synthesis, agreed_at

templates
  id, category, title, prompt_text, sample_text, is_active, sort_order

blessing_drafts
  user_id (pk/fk), body, occasion, audience (jsonb, nullable), updated_at

blessings
  id, author_id, content_type ('text'|'audio'|'video', P1 恒 text),
  body, media (jsonb, nullable, P1 恒 null),
  occasion, scope ('broadcast'|'reply'),
  audience (jsonb: radiusKm, ageMin, ageMax, gender, tags),
  reply_to_user_id (nullable),
  recipient_ids (jsonb string[]),            -- 提交时定格的收件人快照
  state (enum), public_slug (uniq),
  created_at, published_at, delivered_at, expires_at, hold_until,
  moderation (jsonb: verdict, categories, provider_ref),
  renew_count, counted_in_streak

blessing_events      -- 状态转移审计（独立表）
  id, blessing_id, from_state, to_state, trigger, actor, reason, at

reports              -- 举报 / 疑似 / 申诉 统一工单
  id, blessing_id, origin, category, state, priority, assignee,
  resolution_reason, reporter_fingerprint, count, created_at, resolved_at, timeline (jsonb)

streak_days
  user_id, local_date, published_count   PK (user_id, local_date)

inbox_items          -- 收件箱条目
  id, recipient_id, sender_id, blessing_id, delivered_at, read_at (nullable)

notifications        -- 站内通知
  id, user_id, kind ('blessing_received'), blessing_id, from_user_id,
  created_at, read_at (nullable)
```

收件箱 / 通知**只存引用**（blessingId + senderId），正文和当前可见状态读取时从
`blessings` + `blessing.state` 现算，保证撤回 / 下架 / 过期后收件箱里那条也变占位。

## 8. API 草图（P1）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/auth/wx/url` | 取微信授权跳转地址 | 无 |
| GET | `/api/auth/wx/callback` | 授权回调 → 建/取用户 + 会话 | 无 |
| GET | `/api/me` | 当前用户 | 会话 |
| GET | `/api/profile/me` | 个人空间（落款、城市、偏好） | 会话 |
| PUT | `/api/profile/me` | 更新个人空间 | 会话 |
| POST | `/api/account/deletion` | 发起注销（P1 走人工 / 占位） | 会话 |
| GET | `/api/agreement/current` | 当前协议版本与条款 | 无 |
| POST | `/api/consents` | 记录同意（精选展示默认 = 个人偏好 > 系统默认） | 会话 |
| GET | `/api/templates` | 范本库（只作参考） | 会话 |
| GET | `/api/tags/suggested` | 建议标签 | 会话 |
| PUT/GET | `/api/drafts/me` | 我的草稿（正文 + 场景 + 受众） | 会话 |
| POST | `/api/audience/preview` | 受众预览（命中数 + 上限 + 样本） | 会话 |
| POST | `/api/blessings` | 提交祝福（`scope=broadcast\|reply`）→ slug + 状态 + recipientCount | 会话 |
| GET | `/api/records/outbox` | 发件箱（我发出的祝福 + 状态 + 收件人数） | 会话 |
| GET | `/api/inbox` | 收件箱（收到的祝福，按状态渲染 + 发送者粗粒度信息） | 会话 |
| POST | `/api/inbox/read` | 收件箱标记已读 | 会话 |
| GET | `/api/notifications` | 通知列表 + 未读数 | 会话 |
| POST | `/api/notifications/read` | 通知标记已读 | 会话 |
| POST | `/api/blessings/:id/withdraw` | 撤回 | 会话（作者） |
| POST | `/api/blessings/:id/republish` | 重新发布 | 会话（作者） |
| DELETE | `/api/blessings/:id` | 删除 | 会话（作者） |
| POST | `/api/blessings/:id/renew` | 续期 | 会话（作者） |
| GET | `/api/streak/me` | 回响（送出祝福的累计记录） | 会话 |
| GET | `/api/p/:slug` | 公开页数据（按状态返回正文或占位类型；传播用） | 无 |
| POST | `/api/p/:slug/report` | 举报 | 无（匿名 + 防滥用） |
| GET | `/api/moderation/queue` | 复核队列 | 审核员 |
| POST | `/api/moderation/:reportId/resolve` | 复核结论 | 审核员 |

`GET /p/:slug` 对未 `published` 的祝福**只返回占位类型枚举**（`preparing` / `withdrawn` / `taken_down` / `expired` / `not_found`），绝不返回正文，防止校验期/下架内容泄露。

## 9. 安全与合规要点（P1）

- 公开页 / 收件箱 / 受众预览都不下发 openid、精确经纬度、手机号；发送者信息只到"城市 + 昵称 + 大致距离（四舍五入到 km）"。
- 协议同意逐版本、逐项留痕；"精选展示"默认开启的合规性待法务确认（见 use-cases 开放问题 1 / 调研 ADR-M），代码层把它做成一个可翻转的默认值配置，不硬编码。
- 撤回/过期/下架后落地页 60s 内不再返回正文（缓存失效策略需覆盖 CDN/边缘）。
- 审核所有动作留痕、可追溯；hold 时长记录。
- 无 AI 生成内容 → 落地页不加 AI 标识；但预留"内容由用户创作"说明位。
- 敏感个人信息（P1 文本阶段基本不涉及声纹/人脸）——范本库与撰写提示做"宗教信仰信息最小化"引导。

## 10. 待架构评审确认

1. 后端框架（Fastify vs Express）、前端样式方案（Tailwind vs CSS Modules）——低风险，实现时定。
2. 延迟送达用"请求内同步校验"还是"提交即入队 + worker"——P1 用同步足够，但接口契约按异步设计。
3. `blessing_events` 用独立表还是 `blessings.state_history` jsonb——倾向独立表（审计友好）。
4. ~~续期对 streak 的处理~~ —— 已定（2026-09-02）：链接过期不回撤、续期不加计数。
5. slug 生成策略（随机不可枚举，长度）。
6. 审核后台 P1 是否与主前端同仓同应用（倾向是，用路由 + 角色区分）。
