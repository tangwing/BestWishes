# P1 架构设计（文本静心祝福）

> 状态：v0 草稿，2026-09-02。依据 [use-cases.md](../product/use-cases.md)、[ADR 0003](../adr/0003-p1-tech-stack-web-first.md)（Proposed）、[调研报告](../research/2026-09-01-funds-ai-licensing.md)。
> 待用户验收；ADR 0003 若调整，本文件同步。

## 1. 范围

只覆盖 P1：微信登录、授权协议、范本库、撰写文本祝福（含个性化信息）、草稿、自动内容合规检查、"发布即校验、延迟送达"、可分享卡片/落地页、访客免注册查看、作者管理（撤回/删除/续期）、坚持记录、举报、审核队列。

**不在 P1**：音视频、AI 用心评估、祝福请求/匹配/推荐、悬赏与资金、站内收件箱与 user→user 定向发送、合成视频、原生 App。

## 2. 组件视图

```
┌─────────────────────────────────────────────────────────┐
│  Web 前端 (React + TS + Vite, PWA)                        │
│  - 作者端：登录 → 协议 → 范本 → 撰写 → 校验中 → 分享     │
│  - 访客端：祝福落地页（按状态渲染）+ 举报                │
│  - 审核后台（P1 用最简页面，可后续独立）                │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP/JSON
┌───────────────┴─────────────────────────────────────────┐
│  后端 API (Node + TS)                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ auth          │  │ blessing     │  │ moderation    │  │
│  │ (微信 OAuth)  │  │ (领域核心)   │  │ (队列/复核)   │  │
│  └───────────────┘  └──────┬───────┘  └───────┬───────┘  │
│  ┌───────────────┐         │                  │          │
│  │ consent       │   ┌─────┴──────────────────┴──────┐   │
│  │ (协议同意)    │   │ ModerationProvider (接口)     │   │
│  └───────────────┘   │  - RuleBasedProvider (P1)     │   │
│  ┌───────────────┐   │  - CloudProvider (后续)       │   │
│  │ streak        │   └──────────────────────────────┘   │
│  │ (坚持记录)    │                                        │
│  └───────────────┘                                        │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────┴───────────┐   ┌─────────────────────────┐
│  PostgreSQL               │   │  定时任务 (延迟送达/过期) │
│  users / blessings /      │   │  - 自动通过后置发布      │
│  consents / reports /     │   │  - 到期转 expired        │
│  streak_days / templates  │   │  - hold 超时升级        │
└───────────────────────────┘   └─────────────────────────┘
```

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

## 4. "发布即校验、延迟送达"

1. 作者 `submit` → 创建 Blessing（`verifying`）、生成公开短链、清理对应草稿。作者端立即"已发送"。
2. 同步或近实时调用 `ModerationProvider.check(text, personalization)`：
   - `pass` → `verifying → published`（`publishedAt = now`，链接有效期 = `publishedAt + TTL`）。
   - `suspect` → 停留 `verifying`，建 `review` 工单进队列（优先级：疑似）。
   - `violation` → `verifying → rejected`，记录命中大类。
3. 访客在校验期访问链接 → 落地页渲染"准备中"占位。
4. `hold_timeout`（默认 24h，可配）仍无结论 → 升级 + 通知作者，状态不变。
5. 人工复核结论 → `review_pass` / `review_reject`（见 §6）。
6. 作者可在校验期 `withdraw`（取消）→ `withdrawn`，同时清除待发布定时与关联的自动疑似工单。

P1 的"近实时"实现：`submit` 请求内同步调用 RuleBasedProvider（本地、毫秒级）即可给出 `pass/suspect/violation`；真实云 API 接入后改为异步 + 回调，落地页的"准备中"占位已经为异步留好了位。

## 5. 坚持记录（streak）

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
    check(input: { text: string; personalization: Personalization }):
      Promise<{ verdict: 'pass' | 'suspect' | 'violation'; categories: ModerationCategory[]; providerRef?: string }>;
  }
  ```
- `RuleBasedProvider`（P1）：
  - 违禁/敏感关键词表（涉政、色情、仇恨、诈骗、违法）→ `violation`。
  - **宗教敛财护栏词**（"代祷收费""超度""消灾解厄"…，见调研报告 §1.4）→ `suspect` 或 `violation`（配置）。
  - 结构规则：长度越界、纯符号/乱码、疑似联系方式导流 → `suspect`。
  - 无命中 → `pass`。
- 复核工单 `reports`（统一表，来源 = 举报 / 自动疑似 / 申诉）：
  - 字段：目标祝福、来源、大类、状态（open / in_review / resolved_pass / resolved_takedown / resolved_edit）、处理人、理由、时间线。
  - 优先级排序：高危举报 > 用户申诉 > 自动疑似 > 随机抽检。
  - 审核动作：`review_pass` / `review_reject` / `review_takedown` / `request_edit`，每个动作都留痕并触发对祝福状态机的转移。
- 举报：匿名可提交，记录防滥用信息（IP/设备指纹/频率）；同人对同祝福合并计数；高危大类触发即时 `published → taken_down`（待复核）。

## 7. 数据模型（P1，PostgreSQL）

```
users
  id, wx_openid (uniq), wx_unionid (nullable), nickname, avatar_url,
  region_city, source, created_at

consents
  id, user_id, agreement_version, scope_deliver (bool, 恒 true),
  scope_featured (bool), scope_synthesis (bool), agreed_at

templates            -- 范本库，运营维护
  id, category, title, prompt_text, sample_text, sensitive_guard_passed (bool),
  is_active, sort_order

blessing_drafts
  id, author_id, body, personalization (jsonb), updated_at

blessings
  id, author_id, body, personalization (jsonb), occasion,
  state (enum), public_slug (uniq),
  created_at, published_at (nullable), expires_at (nullable),
  moderation (jsonb: verdict, categories, provider_ref, hold_ms),
  renew_count, state_history (jsonb[] 或独立表 blessing_events)

blessing_events      -- 状态转移审计
  id, blessing_id, from_state, to_state, trigger, actor (system/author/moderator:id),
  reason, at

reports              -- 举报 / 疑似 / 申诉 统一工单
  id, blessing_id, origin (report/auto_suspect/appeal), category,
  state, priority, assignee (nullable), resolution_reason,
  reporter_fingerprint (nullable), created_at, resolved_at
  + report_events (时间线)

streak_days
  user_id, local_date, published_count
  PK (user_id, local_date)
```

`personalization` (jsonb): `{ toName, relation, relationCustom, fromName, fromCity, prefix, suffix }`。

## 8. API 草图（P1）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/auth/wx/url` | 取微信授权跳转地址 | 无 |
| GET | `/api/auth/wx/callback` | 授权回调 → 建/取用户 + 会话 | 无 |
| GET | `/api/me` | 当前用户 | 会话 |
| GET | `/api/agreement/current` | 当前协议版本与条款 | 无 |
| POST | `/api/consents` | 记录同意（含精选展示开关） | 会话 |
| GET | `/api/templates` | 范本库 | 会话 |
| PUT | `/api/drafts/me` | 保存/更新我的草稿 | 会话 |
| GET | `/api/drafts/me` | 取我的草稿 | 会话 |
| POST | `/api/blessings` | 提交祝福（submit）→ 返回 slug + 状态 | 会话 |
| GET | `/api/blessings/mine` | 我的祝福列表 | 会话 |
| POST | `/api/blessings/:id/withdraw` | 撤回 | 会话（作者） |
| POST | `/api/blessings/:id/republish` | 重新发布 | 会话（作者） |
| DELETE | `/api/blessings/:id` | 删除 | 会话（作者） |
| POST | `/api/blessings/:id/renew` | 续期 | 会话（作者） |
| GET | `/api/streak/me` | 坚持记录 | 会话 |
| GET | `/p/:slug` | 访客落地页数据（按状态返回正文或占位类型） | 无 |
| POST | `/api/p/:slug/report` | 举报 | 无（匿名 + 防滥用） |
| GET | `/api/moderation/queue` | 复核队列 | 审核员 |
| POST | `/api/moderation/:reportId/resolve` | 复核结论 | 审核员 |

`GET /p/:slug` 对未 `published` 的祝福**只返回占位类型枚举**（`preparing` / `withdrawn` / `taken_down` / `expired` / `not_found`），绝不返回正文，防止校验期/下架内容泄露。

## 9. 安全与合规要点（P1）

- 落地页不下发 openid、精确位置、手机号；来源只到"城市 + 昵称"。
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
