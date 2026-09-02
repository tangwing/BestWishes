## 1. 项目脚手架与依赖

- [ ] 1.1 建立 pnpm monorepo：`packages/domain` `packages/shared` `packages/config` + `server/`（Node + TS + Fastify）+ `client/`（React + TS + Vite）；`pnpm install` 成功，各包 `build` 通过
- [ ] 1.2 配置 ESLint（`typescript-eslint` strict-type-checked）+ Prettier 于仓库根；`pnpm lint` 通过
- [ ] 1.3 配置分层测试命令：`test:arch` / `test:unit` / `test:integration` / `test:e2e` + 聚合 `test`；各自可独立运行
- [ ] 1.4 **架构测试**：dependency-cruiser 配置落地 coding-standards §3.1 的规则（domain 纯净、依赖方向、无循环、无孤儿）+ `*.arch.test.ts` 断言；`pnpm test:arch` 通过并在 CI 独立成步
- [ ] 1.5 更新 AGENTS.md §5 目录表加入 `client/` `server/` `packages/`；更新 README「Repo layout」与「Getting started」
- [ ] 1.6 配置模块（`featuredDefaultOn` / `bodyMinLen` / `bodyMaxLen` / `linkTtlDays` / `holdTimeoutHours` / `spotCheckRatio`），Zod 解析、默认值、单测
- [ ] 1.7 从 [prototype/](../../../prototype/) 迁移领域模块（`lifecycle` / `visibility` / `streak` / `moderation`）到 `packages/domain`，连同其测试；`test:arch` 保证迁移后仍纯净

## 2. 领域逻辑（纯函数，先写测试）

- [ ] 2.1 为祝福状态机写失败测试：所有合法转移、所有非法转移被拒、`deleted` 为终态（对应 `blessing-delivery` 状态机 scenario）
- [ ] 2.2 实现 `lifecycle` 状态机模块直到 2.1 全绿
- [ ] 2.3 为 `isPubliclyVisible(state, expiresAt, now)` 写测试并实现：仅 `published` 且未过期为 true（对应落地页 scenario）
- [ ] 2.4 为坚持记录写失败测试：当日发布 +1、离开 published -1、归零中断连续、续期不加计数、跨时区按作者地区自然日（对应 `blessing-streak` 全部 scenario）
- [ ] 2.5 实现 `streak` 聚合模块直到 2.4 全绿
- [ ] 2.6 为审核判定映射写测试并实现：`pass→published` / `suspect→verifying+工单` / `violation→rejected` / 超时→保守（对应 `content-moderation` 三档 scenario）

## 3. 内容审核

- [ ] 3.1 定义 `ModerationProvider` 接口；写"更换实现不改契约"的契约测试
- [ ] 3.2 实现 `RuleBasedProvider`：违禁 / 敏感词表→`violation`；宗教敛财护栏词→至少 `suspect`；结构规则（长度、乱码、导流）→`suspect`；无命中→`pass`。单测覆盖每类
- [ ] 3.3 实现审核服务不可用时的保守分支并测试（维持 hold + 进队列，不放行）
- [ ] 3.4 实现复核工单模型（`reports` + 时间线）与队列优先级排序，单测覆盖排序与终态约束
- [ ] 3.5 实现复核动作（通过 / 下架 / 要求修改 / 申诉驳回）对祝福状态机的驱动 + 留痕，单测覆盖

## 4. 数据层

- [ ] 4.1 编写 PostgreSQL 迁移脚本建表（users / consents / templates / blessing_drafts / blessings / blessing_events / reports / streak_days），迁移在空库执行成功
- [ ] 4.2 实现各表的 repository（含 openid 幂等 upsert、slug 唯一），用集成测试（可跑在测试库）覆盖幂等与唯一约束
- [ ] 4.3 实现范本库 seed（每类≥3 条）+ 运营侧护栏词校验；测试：含"代祷收费"的范本被拒

## 5. 后端 API

- [ ] 5.1 实现 auth：`GET /api/auth/wx/url`、`GET /api/auth/wx/callback`、会话中间件；用 stub auth 实现（同接口签名），集成测试覆盖"首次建号 / 再次复用 / 回调重试幂等"
- [ ] 5.2 实现协议：`GET /api/agreement/current`、`POST /api/consents`；测试覆盖必选项拒绝、精选展示开关记录、改版重新确认、默认值配置切换
- [ ] 5.3 实现范本与草稿：`GET /api/templates`、`GET/PUT /api/drafts/me`；测试覆盖草稿不触发审核 / 不生成链接、会话过期后可恢复
- [ ] 5.4 实现祝福提交与管理：`POST /api/blessings`（受理即返回、内部同步校验落状态）、`GET /api/blessings/mine`、`withdraw` / `republish` / `DELETE` / `renew`；集成测试覆盖 `blessing-delivery` 的每条 scenario
- [ ] 5.5 实现落地页数据接口 `GET /p/:slug`：published 且未过期返回正文 + 来源；其它状态只返回占位类型枚举。测试：verifying / withdrawn / taken_down / expired 均不返回正文
- [ ] 5.6 实现举报 `POST /api/p/:slug/report`：匿名可提交、防滥用记录、同源合并、高危即时临时下架。集成测试覆盖
- [ ] 5.7 实现坚持记录 `GET /api/streak/me`：仅本人、与有效祝福集合一致。集成测试覆盖回撤即时反映
- [ ] 5.8 实现审核后台接口 `GET /api/moderation/queue`、`POST /api/moderation/:reportId/resolve`：角色鉴权、优先级排序、结论留痕
- [ ] 5.9 实现定时任务：到期祝福转 `expired`、hold 超时升级 + 通知。用可注入时钟的单测覆盖

## 6. 前端

- [ ] 6.1 应用骨架、路由、会话态、微信 H5 环境适配；`npm run build` 通过
- [ ] 6.2 登录页 + 未登录访客可看落地页 / 不能进创作（对应 `wx-account` scenario）
- [ ] 6.3 授权协议页：分层勾选、精选展示默认态跟随配置、改版重新确认
- [ ] 6.4 范本选择 + 自由创作入口；范本加载失败回退自由创作
- [ ] 6.5 撰写页：正文 + 结构化个性化字段 + 静心引导（无计时无评分）+ 前后端字数校验 + 自动存草稿
- [ ] 6.6 提交后「已发送・审核中」态 + 拿到可分享链接 + 轮询最终状态
- [ ] 6.7 分享：微信分享调用 + 复制外链兜底
- [ ] 6.8 访客落地页：按占位类型渲染（正文 / 准备中 / 已收回 / 已下架 / 已过期 / 未找到）+ 举报入口 + "我也写一段"引导
- [ ] 6.9 我的祝福：列表 + 撤回 / 重新发布 / 删除（二次确认 + 已分发副本不可追回告知）/ 续期
- [ ] 6.10 坚持记录页：温和文案、仅本人、无排行无积分
- [ ] 6.11 审核后台页面：队列（优先级）+ 复核动作 + 留痕展示

## 7. 端到端验收

- [ ] 7.1 端到端脚本：登录 → 同意协议 → 选范本 → 撰写 → 提交 → 校验中占位 → 通过 → 访客看到正文 → 撤回 → 访客看到占位 → 坚持记录回撤。全链路通过
- [ ] 7.2 端到端：命中护栏词 → suspect → 进队列 → 人工通过 → 送达；命中违禁词 → rejected → 访客占位
- [ ] 7.3 端到端：链接到期 → expired 占位 → 作者续期 → 恢复可见（未重新审核）
- [ ] 7.4 逐条核对 [use-cases.md](../../../docs/product/use-cases.md) 的 P1 验收标准，产出"满足 / prototype 满足 / 阻塞于外部账号"清单
- [ ] 7.5 `openspec validate add-p1-text-blessing --strict` 通过；PROMPT_LOG.md、CHANGELOG.md 更新
