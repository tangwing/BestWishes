## Context

当前登录（`server/src/application/auth-service.ts` 的 `loginWithStub`）是纯占位：输入昵称即创建/复用一个用户，靠 `bw_uid` httpOnly cookie 维持会话（见 `server/src/interface/http/session.ts`），没有任何角色或权限概念。`users` 表（`server/src/infrastructure/db/schema.ts`）目前只有昵称、来源等最小字段。

审核台的两个接口（`GET /api/moderation/queue`、`POST /api/moderation/:reportId/resolve`）目前只做 `requireUserId`（登录即可），业务逻辑本身（工单状态机、pass/takedown/request_edit）在 `moderation-queue-service.ts`，本变更不动它。

真实的微信授权登录、真正的账号体系是 P2 及以后才会落地的（见 AGENTS.md §6"尚未决定"）。本变更要在"登录仍是 stub"的前提下，先把角色和门禁的骨架搭对，等真实账号体系落地时只需要换掉"角色怎么来"的那一小块。

## Goals / Non-Goals

**Goals:**
- 引入最小可用的角色模型（`user` / `admin`），落在 `users` 表上。
- 审核台两个接口只有 `admin` 能调用，非 `admin` 返回 403。
- 前端对非管理员隐藏入口、给出明确的无权限提示。
- admin 账号的产生方式在 stub 登录阶段也能用，且不需要碰真实账号体系就能在 P2 换掉。

**Non-Goals:**
- 不做细粒度权限（多角色矩阵、按资源的 ACL）——P1 只需要"是不是管理员"这一个布尔判断。
- 不做管理员管理界面（增删管理员、审计日志）——P1 靠环境变量配置，运营需要时手改配置重启。
- 不改审核台本身的业务逻辑（工单状态机、举报流程）。
- 不改真实登录方式——微信授权登录本身仍是 P2 议题（ADR 0003 §D 系列）。

## Decisions

### 1. 角色存在哪：`users` 表加 `role` 字段

**决定**：在 `server/src/infrastructure/db/schema.ts` 的 `users` 表加一列 `role: text('role').$type<'user' | 'admin'>().notNull().default('user')`；内存仓储 `UserRecord` 同步加 `role` 字段。

**理由**：角色是身份/鉴权属性，不是"别人筛选你时能看到的画像"，不应该混进 `user_profiles`（那张表是给受众匹配用的：位置/性别/年龄/标签）。P1 只需要两种角色，单字段布尔式的 `'user' | 'admin'` 枚举足够；不建独立的 `roles` / `user_roles` 表——那是为多对多权限设计的，当前用不上，属于过度设计。

**备选方案**：独立 `admin_users` 表（只存 admin 的 userId）。放弃理由：多一张表、多一次 join，换来的唯一好处是"以后角色更多时不用改 users 表结构"——但 P1 明确只需要两种角色，YAGNI。

### 2. 管理员账号怎么产生：登录时按环境变量授予

**决定**：新增配置项 `BW_ADMIN_NICKNAMES`（逗号分隔的昵称列表，仿照现有 `BW_HOLD_SECONDS` 等 `app-config.ts` 里的运营可调配置模式）。`loginWithStub` 在创建/复用用户后，如果这次登录的昵称命中列表，就把该用户的 `role` 置为 `admin`（幂等：每次登录都会确保角色状态和配置一致，包括把不在列表里的用户降级回 `user`，防止配置改过之后旧的管理员权限残留）。

**理由**：当前登录本身就是"填昵称即登录"的占位，没有密码、没有唯一身份凭证（openid）。在这个前提下，任何"新建一个专门的管理员登录入口"或"种子脚本预建管理员账号"的方案，都要么引入一套新的认证机制（超出本变更范围），要么在内存模式下重启即失效（种子数据在 `createInMemoryRepositories` 启动时插入，但演示环境经常重启，脚本还要处理"用户可能还没注册"的时序问题）。用环境变量在登录时授予角色，复用了现有的"运营可调配置"模式，本地演示和测试都只需要设一个环境变量、用约定好的昵称登录即可，不需要额外的 UI 或脚本。

**备选方案**：
- 种子脚本预建管理员用户 → 放弃：内存模式下重启失效，PGlite 模式下还要处理"脚本跑的时候表可能还没迁移"的顺序问题，复杂度不成比例。
- 单独的 `/api/auth/admin-login`（带共享密钥）→ 放弃：现在是 demo 阶段，加一条独立的认证通道相当于维护两套登录逻辑，等 P2 真实微信登录 + 真实账号体系落地时这条通道大概率要整个重做，不值得现在投入。

**升级路径**：P2 换成真实微信登录后，"角色怎么授予"这一步整个替换（比如后台人工把某个 openid 标记为 admin），`role` 字段和门禁逻辑本身不用动——这是本决策特意换来的隔离点。

### 3. 门禁怎么加：`requireAdmin` 守卫

**决定**：在 `server/src/interface/http/session.ts` 里，在现有 `requireUserId` 旁边加一个 `requireAdmin(deps, request): Promise<string>`（返回 userId，非 admin 时 `throw new AppException('forbidden', ...)`，映射到 HTTP 403）。审核台两个路由用它替换掉现在的 `requireUserId(request)`。

**理由**：和现有 `requireUserId` 保持同一种"读 cookie → 校验 → 拿到可信身份"的调用形状，路由代码改动最小（一行替换）。角色查询走 `deps.repos.users.findById`，不需要新加仓储接口。

### 4. 前端怎么表现

**决定**：`GET /api/me` 的返回（`SessionUser`）加 `role` 字段；`client/src/app/session.ts` 的会话状态带上它；导航栏"审核台"入口仅 `role === 'admin'` 时渲染；`Moderation.tsx` 收到 403（`ApiCallError` code `forbidden`）时渲染"没有权限访问审核台"提示，而不是空列表或报错崩溃。

**理由**：隐藏入口是体验层面的"别让普通用户看到用不了的按钮"，后端的 403 才是真正的安全边界——两者都要，缺前端提示会让直接改 URL 访问的用户看到一个空白或出错的页面。

## Risks / Trade-offs

- **[风险] 昵称不是唯一身份**：stub 登录下，两个不同的人都可以填一样的昵称。如果 `BW_ADMIN_NICKNAMES` 里的昵称被别人蹭到，会被误授予 admin。
  → **缓解**：这是 P1 stub 登录阶段本身就有的信任边界（现在任何昵称都能读到自己的画像、发祝福），不是本变更引入的新洞；把管理员昵称当"演示口令"一样保密即可。文档（DEMO.md）里会注明这一点。真正的身份唯一性要等 P2 真实登录落地才能解决，属于登录机制本身的议题，不是角色系统能单独修的。
- **[风险] 环境变量改了但老会话还带着旧角色**：如果运营改了 `BW_ADMIN_NICKNAMES` 却没让被降级的管理员重新登录，其 cookie 对应的 `role` 已经在上次登录时写死在 `users` 表里，门禁读的是表里的值，不会立刻感知配置变化。
  → **缓解**：门禁读的是持久化的 `role` 字段而不是每次请求都读环境变量，这是有意的（否则每个请求都要解析环境变量列表，且和"哪个具体用户是不是 admin"这件事本该是持久状态而非运行时配置产生耦合）。运营改配置后要求相关账号重新登录一次即可生效，可在运维说明里注明。

## Migration Plan

1. drizzle 迁移：`users` 表加 `role` 列，`default('user')`，历史行自动回填为 `user`，无需数据回填脚本。
2. 内存仓储 `UserRecord` 加 `role` 字段，默认 `'user'`。
3. `loginWithStub` 加上按配置授予/收回 admin 角色的逻辑。
4. 审核台两个路由换成 `requireAdmin`。
5. 前端会话类型、导航、`Moderation.tsx` 无权限态。
6. 回滚：这是纯加法变更（新增列 + 新增校验分支），出问题可以直接回退代码；`role` 列即使不再使用也不影响其它功能，无需专门的回滚迁移。
