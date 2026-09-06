## 1. 数据层：角色字段

- [ ] 1.1 `server/src/infrastructure/db/schema.ts` 的 `users` 表加 `role` 列（`text`，`$type<'user' | 'admin'>()`，`notNull().default('user')`），跑 `pnpm --filter @bestwishes/server db:generate` 生成迁移，确认新迁移文件只包含这一列的 `ALTER TABLE`
- [ ] 1.2 `server/src/ports/records.ts`（或 `UserRecord` 所在类型定义处）给用户记录类型加 `role: 'user' | 'admin'`，`pnpm typecheck` 通过
- [ ] 1.3 `in-memory-repositories.ts` 的用户仓储：新建用户时 `role` 默认 `'user'`；补一个更新角色的方法（如 `setRole(userId, role)`），单元测试覆盖"创建默认 user"和"setRole 后能读回新角色"
- [ ] 1.4 `pg-repositories.ts` 的用户仓储：同步实现 `role` 的读写映射；`pg-repositories.test.ts` 加一个用例验证 `role` 列能正确落盘和读回（PGlite）

## 2. 配置：管理员昵称列表

- [ ] 2.1 `packages/domain/src/config.ts` 加 `adminNicknames: string[]`（默认空数组），`server/src/config/app-config.ts` 支持从 `BW_ADMIN_NICKNAMES`（逗号分隔）解析并覆盖默认值，`app-config.test.ts` 加解析测试（含"未设置时为空数组"和"逗号分隔正确拆分并 trim"两个用例）

## 3. 登录时按配置授予 / 收回角色

- [ ] 3.1 `server/src/application/auth-service.ts` 的 `loginWithStub`：登录成功后，若昵称命中 `config.adminNicknames` 且当前角色不是 `admin`，调用 `setRole(userId, 'admin')`；若不命中且当前角色是 `admin`，调用 `setRole(userId, 'user')`
- [ ] 3.2 集成测试（`blessing-flow.test.ts` 或新建 `auth-service.test.ts`）覆盖 spec 里的两个场景：昵称命中配置 → 角色变 `admin`；曾经命中、后来配置移除该昵称、再次登录 → 角色变回 `user`

## 4. 后端门禁

- [ ] 4.1 `server/src/interface/http/session.ts` 加 `requireAdmin(deps, request): Promise<string>`：内部调用 `requireUserId`，查用户角色，非 `admin` 时 `throw new AppException('forbidden', ...)`；确认 `AppException` 到 HTTP 状态码的映射（`server/src/interface/http/*` 里处理错误的地方）里 `forbidden` 映射到 403
- [ ] 4.2 `routes.ts` 把 `/api/moderation/queue` 和 `/api/moderation/:reportId/resolve` 的 `requireUserId(request)` 换成 `requireAdmin(deps, request)`，并去掉那句"demo：任何会话都能进；真实按角色鉴权"的注释（用途已经不存在）
- [ ] 4.3 `api-flow.test.ts` 或 `server.test.ts` 加两个端到端用例：普通用户请求 `/api/moderation/queue` 返回 403；管理员请求正常返回队列内容（覆盖 spec 的四个 scenario：普通用户被拒、管理员成功、未登录 401、审核台两个接口分别验证）

## 5. 前端

- [ ] 5.1 `client/src/api/client.ts` 的 `SessionUser` 加 `role: 'user' | 'admin'`
- [ ] 5.2 导航组件：仅 `role === 'admin'` 时渲染"审核台"入口
- [ ] 5.3 `client/src/app/pages/Moderation.tsx`：捕获 `ApiCallError` code 为 `forbidden` 时渲染"没有权限访问审核台"提示，不渲染队列列表

## 6. 端到端验证 + 文档

- [ ] 6.1 `e2e/tests/moderation.spec.ts` 加一个场景：以普通用户身份登录，导航看不到"审核台"，直接访问 `/moderation` 看到无权限提示；再以配置好的管理员昵称登录，能看到入口并正常使用审核台
- [ ] 6.2 `docs/DEMO.md` 补一节：如何设置 `BW_ADMIN_NICKNAMES` 本地跑通管理员登录 + 审核台，并注明"stub 登录下昵称不是唯一身份，管理员昵称当演示口令保密"这条已知限制
- [ ] 6.3 `pnpm verify` 全绿；`pnpm test:e2e` 全绿
