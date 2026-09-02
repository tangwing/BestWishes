## 1. 项目脚手架与依赖

- [x] 1.1 建立 pnpm monorepo：`packages/domain` `packages/shared` + `server/`（Node + TS + Fastify）+ `client/`（React + TS + Vite）+ `arch/`；`pnpm install` 成功，各包 `build` 通过（`packages/config` 暂不建，配置放各处；见 BACKLOG）
- [x] 1.2 配置 ESLint（`typescript-eslint` strict-type-checked + stylistic）+ Prettier 于仓库根；`pnpm lint` / `prettier --check` 通过
- [x] 1.3 配置分层测试命令：`test:arch` / `test:unit` / `test:integration` / `test:e2e`(占位) + 聚合 `test`（vitest workspace，各 project 可独立跑）
- [x] 1.4 **架构测试**：`.dependency-cruiser.cjs` 落地 domain 纯净 / 依赖方向 / 无循环 / 无孤儿 + `arch/architecture.test.ts` 断言；`pnpm test:arch` 通过、独立 project
- [x] 1.5 更新 AGENTS.md §5 目录表 + README「Repo layout / Getting started」为 monorepo
- [x] 1.6 配置模块：`domain/config.ts` 的 `DEFAULT_CONFIG` + `server/config/app-config.ts`（`BW_*` 环境变量覆盖，Zod 解析，单测覆盖默认 / 覆盖 / 非法）
- [x] 1.7 从 `prototype/` 迁移领域模块（`lifecycle` / `visibility` / `streak` / `moderation`）到 `packages/domain` + 测试（78 个）；`test:arch` 绿。清理到 strict lint（去 dynamic-delete、码位计数等）

## 2. 领域逻辑（纯函数，先写测试）

- [x] 2.1 / 2.2 祝福状态机 `lifecycle`（转移表 + 合法 / 非法转移测试 + `deleted` 终态 + `verifying→withdrawn`）—— 随 `packages/domain` 迁移，33 测试
- [x] 2.3 `isPubliclyVisible` / `placeholderType` —— 迁移，16 测试
- [x] 2.4 / 2.5 坚持记录 `streak`（+1 / 回撤 / 归零中断 / 续期不加 / 跨时区）—— 迁移，12 测试
- [x] 2.6 审核判定映射 `outcomeFor`（三档 + 超时保守）—— 迁移，6 测试
- [ ] 2.7 补 spec 迭代新增但 domain 层还没覆盖的：链接过期不回撤（这条在 application 层验证，见 §5.5）

## 3. 内容审核

- [x] 3.1 `ModerationProvider` 接口（在 `domain/types.ts`）+ 契约测试 —— 迁移
- [x] 3.2 `RuleBasedProvider`（违禁→violation / 护栏词→suspect / 结构规则→suspect / 无命中→pass）—— 迁移，11 测试
- [x] 3.3 `UnavailableProvider` + `outcomeFor` 的保守分支 —— 迁移
- [ ] 3.4 复核工单模型 —— `ReportRecord` + `InMemoryReportRepository`（优先级排序、同源合并查询、终态）已建；工单编排（application 层）在 §5
- [ ] 3.5 复核动作驱动状态机 —— application 层，见 §5.9

## 4. 数据层

- [ ] 4.1 PostgreSQL 迁移脚本（Drizzle）—— **推迟到 B-24**（本机无 psql；开发用内存实现）
- [x] 4.2a `ports/repositories.ts` 定义全部仓储接口 + `Repositories` 聚合；`ports/records.ts` 记录类型；`ports/ids.ts`（IdGenerator / SlugGenerator）
- [x] 4.2b `infrastructure/memory/` 内存实现（openid 幂等、slug 唯一、读写 clone、工单优先级排序）+ 测试
- [ ] 4.2c PG 实现（Drizzle）+ testcontainers 集成测试 —— B-24
- [ ] 4.3 范本库 seed（每类≥3 条，从 prototype/seed.ts 迁）+ 运营侧护栏词校验；测试：含"代祷收费"的范本被拒

## 5. application 层用例 + 后端 API

> iteration 3 完成了 application 层（`server/src/application/`）：auth / profile / consent / drafts / blessings / streak / scans + 12 个端到端流程测试。HTTP 路由是下一步。

- [x] 5.1a `AuthService`（`loginWithStub` + `currentUser`，openid 幂等）；真实微信回调路由待接
- [x] 5.2a `ProfileService`（view / update，城市粒度靠 Zod max、定位开关、精选偏好，个人偏好 > 系统默认）
- [x] 5.3a `ConsentService`（`agreement` / `hasValidConsent` / `record`，必选项拒绝，默认值来源优先级）
- [x] 5.4a `DraftService`（get / save，不触发审核 / 不生成链接）
- [x] 5.5a `BlessingService`（`submit`：受理即返回、同步规则审核落状态、合并个人空间默认值、字数校验、consent 校验；`withdraw` / `republish` / `delete` / `renew`；`outbox`；`inbox` 空状态）
- [x] 5.6a `BlessingService.getPublicPage`：仅 `published` 且未过期返回正文，其它只返回占位类型
- [x] 5.8a `StreakService.view`：仅本人、与有效集合一致、跨时区
- [x] 5.10a `Scans`（`publishReady` 延迟送达、`expire` 到期、`escalateStuck` hold 超时）+ 可注入 `FakeClock`
- [ ] 5.1b…5.10b 把上面的用例包成 Fastify 路由（薄 handler + Zod schema + 会话中间件 + 错误映射），集成测试打 `app.inject`
- [ ] 5.7 举报 `reportBlessing`（匿名、同源合并、高危即时临时下架）+ 路由
- [ ] 5.9 审核队列 `listQueue` / `resolveReport`（优先级排序、结论驱动状态机、留痕）+ 路由

## 6. 前端

- [ ] 6.1 应用骨架、路由、会话态、微信 H5 环境适配；`build` 通过
- [ ] 6.2 登录页（昵称即可）+ 未登录访客可看落地页 / 不能进创作（对应 `wx-account` scenario）
- [ ] 6.3 个人空间页：落款 / 城市预设、定位授权开关（占位）、精选展示默认偏好、坚持记录入口、退出、发起注销
- [ ] 6.4 授权协议页：分层勾选、精选展示默认态 = 个人偏好 > 系统默认、改版重新确认
- [ ] 6.5 范本参考（无一键填入、示例 `user-select:none`）+ 自由创作；范本加载失败回退自由创作
- [ ] 6.6 撰写页：正文（拦粘贴 + 温和提示）+ 三项发送者信息（默认取个人空间）+ 静心与发心引导（无计时无评分）+ 前后端字数校验 + 自动存草稿
- [ ] 6.7 提交后「已发送・审核中」态 + 拿到可分享链接 + 轮询最终状态
- [ ] 6.8 分享：微信分享调用 + 复制外链兜底
- [ ] 6.9 访客落地页：按占位类型渲染（正文 / 准备中 / 已收回 / 已下架 / 已过期 / 未找到）+ 举报入口 + "我也写一段"引导
- [ ] 6.10 收发记录页：发件箱（撤回 / 取消 / 重新发布 / 删除 / 续期）+ 收件箱空状态
- [ ] 6.11 坚持记录页：温和文案、仅本人、无排行无积分
- [ ] 6.12 审核后台页面：队列（优先级）+ 复核动作 + 留痕展示

## 7. 端到端验收

- [ ] 7.1 端到端脚本：登录 → 同意协议 → 选范本 → 撰写 → 提交 → 校验中占位 → 通过 → 访客看到正文 → 撤回 → 访客看到占位 → 坚持记录回撤。全链路通过
- [ ] 7.2 端到端：命中护栏词 → suspect → 进队列 → 人工通过 → 送达；命中违禁词 → rejected → 访客占位
- [ ] 7.3 端到端：链接到期 → expired 占位 → 作者续期 → 恢复可见（未重新审核）
- [ ] 7.4 逐条核对 [use-cases.md](../../../docs/product/use-cases.md) 的 P1 验收标准，产出"满足 / prototype 满足 / 阻塞于外部账号"清单
- [ ] 7.5 `openspec validate add-p1-text-blessing --strict` 通过；PROMPT_LOG.md、CHANGELOG.md 更新
