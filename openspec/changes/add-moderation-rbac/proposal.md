## Why

审核台（`/api/moderation/queue`、`/api/moderation/:reportId/resolve`）现在对任何登录用户开放——路由代码里明确写着"demo：任何会话都能进；真实按角色鉴权"。这只是 P1 demo 阶段的占位，但用户在走查中指出：这个能力（通过 / 下架别人的祝福）不应该对所有人开放，需要专门的管理员账号和真正的权限管理。当前登录本身只是"输昵称即登录"的占位，完全没有角色概念，这是补上这块权限能力的前提。

## What Changes

- 新增**用户角色**概念：至少区分`user`（默认）和`admin`两种角色，落在用户身上（而非画像上）。
- 审核台两个接口加权限校验：非 `admin` 调用返回 `403`，不再是"任何会话都能进"。
- 新增**管理员账号的产生方式**（见 design.md 的具体方案与理由；不在本节展开）。
- 前端"审核台"导航项对非管理员隐藏；非管理员直接访问 `/moderation` 页面时给出"无权限"提示而非空审核台。
- **不改变**审核台本身的业务逻辑（工单状态机、pass/takedown/request_edit 三个动作、举报提交）——这些属于既有的 `content-moderation` 能力，本变更只加一层"谁能调用"的门禁。

## Capabilities

### New Capabilities

- `access-control`: 用户角色（`user` / `admin`）的定义与来源、角色如何赋予与查询、按角色保护指定接口的鉴权规则、未授权时的错误形状（403 + 错误码）。

### Modified Capabilities

（无——`content-moderation` 尚未从 `add-p1-text-blessing` 归档进 `openspec/specs/`，本变更不改它的业务行为，只是在其两个接口前面加一层门禁，属于 `access-control` 新能力的范围，不需要对 `content-moderation` 开 delta。）

## Impact

- **后端**：`server/src/interface/http/routes.ts`（审核台两个路由加鉴权中间件/守卫）、`server/src/interface/http/session.ts`（`requireUserId` 之外新增 `requireAdmin` 一类的守卫，或在 `AppDeps` 里加角色查询）、用户存储层（`server/src/infrastructure/db/schema.ts` 的 `users` 表加 `role` 字段、对应的内存仓储 `in-memory-repositories.ts`、`pg-repositories.ts`）、需要一条 drizzle 迁移。
- **前端**：`client/src/app/` 的导航栏（隐藏"审核台"入口）、`Moderation.tsx` 页面（非管理员时的提示态）、`client/src/app/session.ts`（会话里带上角色，供前端判断）。
- **测试**：`server/src/application/moderation-queue-service.ts` 附近的集成测试要加"非管理员被拒"的用例；e2e 的 `moderation.spec.ts` 要加一个"普通用户看不到/进不了审核台"的场景。
- **不涉及**：陌生人群发的核心模型（ADR 0004）、`blessing-service.ts` 的状态机本身、`packages/domain` 的祝福生命周期。
