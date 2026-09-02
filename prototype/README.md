# P1 走查原型（spike）

> **这不是生产代码。** 目的：把 P1（文本静心祝福）的核心流程和领域规则跑起来，供评审、走查、验证验收标准。
> 技术方向见 [../docs/adr/0003-p1-tech-stack-web-first.md](../docs/adr/0003-p1-tech-stack-web-first.md)（Proposed）。
> 需求见 [../docs/product/use-cases.md](../docs/product/use-cases.md)、[../openspec/changes/add-p1-text-blessing/](../openspec/changes/add-p1-text-blessing/)。

## 跑起来

```bash
cd prototype
npm install
npm test          # 领域逻辑 + store 集成 + 页面冒烟 + 架构测试
npm run test:arch # 只跑架构测试：dependency-cruiser + *.arch.test.ts
npm run verify    # typecheck + test:arch + test + build，一条龙
npm run dev       # 打开 http://localhost:5173
```

## 里面有什么

| 目录 | 内容 | 会不会进真实实现 |
|---|---|---|
| `src/domain/` | 纯函数领域模块：祝福状态机、可见性投影、坚持记录、审核判定映射、`ModerationProvider` 接口 + 规则实现 | **会**——这些模块设计成可直接迁往 `packages/domain` 与跨端共享 |
| `src/arch/` | 架构测试：守住"领域层不依赖框架 / 存储"。`.dependency-cruiser.cjs` + `*.arch.test.ts` | 会——规则随代码库演进扩展 |
| `src/store/repo.ts` | 应用服务层：把领域模块 + 内存/localStorage 存储 + 规则审核编排起来，对标后端 API | 参考实现，真实版是 Node + PostgreSQL |
| `src/store/seed.ts` | 范本库种子 + 护栏词校验 | 内容会复用，形式换成运营后台 |
| `src/app/` | React 前端：作者流程、访客落地页、审核台 | 交互参考；视觉稿见 Claude Design 画布 |

## 与 P1 的对应

- **发布即校验、延迟送达**：提交后祝福 `verifying`，作者立即拿到分享链接，访客看"准备中"占位。规则审核 `pass` 后平台 hold 一段时间（原型压缩成 6 秒）才 `published`。
- **访客免注册**：`/p/:slug` 无登录墙，按状态渲染正文或中性占位。落地页数据接口只下发占位类型枚举，不下发未发布内容的正文。
- **无 AI 评估、无资金**：符合 P1 锁定范围。
- **走查工具**（页面顶部虚线框，仅原型）：跳过送达 hold、触发链接过期、切换审核模式（正常 / 护栏词=违规 / 服务不可用）、切换"精选展示"默认值、清空数据。

## 已知边界（原型简化，真实实现要补）

- 微信登录是占位登录（`loginStub`）。
- 内容审核是关键词规则，不是真实内容安全 API。
- 存储在浏览器 localStorage，非多端共享。
- 没有 `server/`、没有数据库迁移——见 openspec `tasks.md` 的完整实现计划。
- 微信分享、hold 超时通知、防刷限频、审核员分级等按接口/数据结构留位，未完整实现。
