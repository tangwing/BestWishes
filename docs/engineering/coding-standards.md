# BestWishes 工程规范（代码标准）

> 状态：v1，2026-09-02。适用于 [ADR 0003](../adr/0003-p1-tech-stack-web-first.md) 选定的技术栈。
> **所有生产代码必须遵循本文件。** 它是 [AGENTS.md](../../AGENTS.md) §4「代码工艺标准」（过程纪律）的技术落地补充：AGENTS.md 管「怎么改」，本文件管「怎么写」。
> 评审者以本文件为准据。与 AGENTS.md 冲突时，以 AGENTS.md 为准。

## 0. 总则

1. **可读性优先于精巧。** 代码首先写给人看。一段需要停下来推敲的"聪明"代码，几乎总应该换成更直白的写法。
2. **架构清晰、分层明确。** 依赖方向单向（见 §3）。任何"图省事"的反向依赖都要在评审中被挡下。
3. **注释充足，但注释「为什么」不是「是什么」。** 见 §7。
4. **性能是设计问题，不是事后优化。** 但不做没有数据支撑的猜测性优化。见 §11。
5. **一切自动化。** 格式化、lint、类型检查、测试都在 CI 强制；本地 pre-commit 兜底。规范里凡能被工具检查的，就交给工具，评审只看工具查不了的。

## 1. 技术栈基线

| 层 | 选型 | 版本策略 |
|---|---|---|
| 语言 | TypeScript（`strict` 全开） | 跟随 LTS，主版本升级走 ADR |
| 包管理 / 仓库 | pnpm workspaces（monorepo） | lockfile 提交，CI `--frozen-lockfile` |
| 前端 | React + Vite，CSS Modules | — |
| 后端 | Node.js LTS + Fastify | — |
| 数据库 | PostgreSQL + Drizzle ORM | 迁移脚本版本化，只进不改 |
| 校验 | Zod（跨前后端共享 schema） | — |
| 测试 | Vitest（单元 / 集成）、Playwright（E2E） | — |
| 质量 | ESLint（`typescript-eslint` strict-type-checked）+ Prettier | 配置在仓库根，不允许分包覆盖规则除非有注释理由 |

外部参考：[typescript-eslint](https://typescript-eslint.io/)、[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)、[Fastify Guides](https://fastify.dev/docs/latest/Guides/)、[The Twelve-Factor App](https://12factor.net/)、[Conventional Commits](https://www.conventionalcommits.org/)。本文件与它们冲突处以本文件为准。

## 2. 仓库结构（monorepo）

```
packages/
  domain/          纯领域逻辑：实体、状态机、不变量、值对象。零 IO、零框架依赖。
  shared/          跨端共享的类型与 Zod schema（DTO、错误码、常量）。
  config/          共享的 tsconfig / eslint / prettier 预设。
server/
  src/
    interface/     入口适配器：Fastify 路由、请求/响应 schema、鉴权中间件。
    application/    用例编排（application services）：事务边界、调用 domain + ports。
    infrastructure/ 出口适配器：Drizzle 仓储、外部 API 客户端、队列、时钟。
    ports/          application 依赖的接口（Repository、ModerationProvider、Clock…）。
    main.ts        组合根（composition root）：装配依赖、启动。
client/
  src/
    features/<feature>/   按功能切分：组件、hooks、本地状态、样式。
    shared/              跨功能的 UI 原语、hooks、api 客户端。
    app/                 路由、Provider、入口。
```

- **`packages/domain` 不允许 import 任何 `server/` 或 `client/` 的东西，也不允许 import 框架、ORM、`node:*` 之外的运行时库。** 违反即评审阻断。
- 每个包有自己的 `package.json` 和 `tsconfig.json`，`extends` `packages/config`。

## 3. 架构与依赖规则

分层（Hexagonal / Ports & Adapters 的简化版）：

```
interface ──▶ application ──▶ domain
     │             │
     └──▶ ports ◀──┘        （application 定义 ports 接口）
                  ▲
          infrastructure    （infrastructure 实现 ports）
```

**依赖只能指向内层。** 具体规则：

- `domain`：不依赖任何其它层。
- `application`：依赖 `domain` 和 `ports`（接口），**不依赖** `infrastructure` 或 `interface`。
- `infrastructure`：实现 `ports`，依赖 `domain`（用其类型）。
- `interface`：依赖 `application`。
- 依赖注入在 `main.ts`（组合根）完成。业务代码里**不出现** `new PostgresXxxRepository()`——通过构造参数注入。
- 用 ESLint `import/no-restricted-paths` 或 `eslint-plugin-boundaries` 机制化强制。

**为什么这样分**：让「业务规则」可以脱离数据库和 HTTP 单独测试与演进；让「换 Fastify 为别的」「换 Postgres 为别的」是改一层的事。呼应 ADR 0003 的灵活性目标。

### 3.1 架构测试（fitness functions）

分层规则不能只靠评审盯——要有测试守住。用 **dependency-cruiser**（TypeScript 生态里对标 Java ArchUnit 的工具）+ 少量断言式测试。

- **独立的测试套件**：架构测试单独成套，单独的命令（`pnpm test:arch`），在 CI 里作为独立一步跑，**先于**功能测试。它红了直接挡合并，和某个功能测试失败不混在一起。
- **dependency-cruiser** 配置（`.dependency-cruiser.cjs`）至少覆盖：
  - `packages/domain` 不得依赖 `server/`、`client/`、任何框架 / ORM / `node:*` 之外的运行时库；
  - `application` 不得依赖 `infrastructure` / `interface`；
  - `infrastructure` / `interface` 不得被 `domain` / `application` 依赖；
  - 无循环依赖；
  - 无孤儿模块（写了没人用的文件）。
- **断言式架构测试**（`*.arch.test.ts`，跑在测试框架里）：覆盖 dependency-cruiser 不好表达的，例如"`domain` 里的导出函数都是纯函数（不 import `Date`/`Math.random`/`fs`）""每个 `application` 用例文件都有对应测试"。
- 每条规则要有一句话说明它防的是什么，规则本身也是文档。
- 新增一层 / 一个包时，同步加它的架构规则——架构规则的 diff 和代码的 diff 一起评审。

## 4. 命名

- 文件：`kebab-case.ts`；React 组件文件 `PascalCase.tsx`。
- 类型 / 接口 / 类 / 组件：`PascalCase`。不给接口加 `I` 前缀。
- 变量 / 函数：`camelCase`。
- 常量（模块级、真正不变）：`SCREAMING_SNAKE_CASE`。
- 布尔：`is` / `has` / `should` / `can` 前缀。
- 函数名是动词短语（`publishBlessing`），返回值是名词。
- 避免缩写，除非是领域通用词（`id`、`url`、`db`）。宁可长一点也要能读懂。
- 不用无意义名（`data`、`info`、`manager`、`util`、`helper` 作为核心抽象的名字）。`utils` 目录只放真正通用、无领域含义的纯函数。

## 5. TypeScript

- `strict: true` 及以下全开：`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`noUnusedLocals`、`noUnusedParameters`。
- **禁止 `any`。** 需要逃逸类型系统时用 `unknown` + 收窄，并写注释说明。`as` 断言同理——每个 `as`（除 `as const`）要么有就近注释，要么改成类型守卫。
- **禁止 `!` 非空断言**，除非紧跟一行注释解释为什么这里不可能为空。优先用早返回 / 类型守卫 / `assert` 函数。
- 领域模型用**判别联合**（discriminated unions）表达状态，`switch` 对 `kind` 做**穷尽**检查（`default: assertNever(x)`）。祝福状态机就是这么写的。
- 优先**不可变**：`readonly` 字段、`ReadonlyArray`、返回新对象而非原地改。领域函数是纯函数。
- `type` 用于联合 / 交叉 / 映射；`interface` 用于对象形状且可能被 `implements`。团队内部一致即可，不纠结。
- 错误处理两种模式，按场景选：
  - **预期内的失败**（校验不通过、状态非法、找不到）→ 返回 `Result<T, E>` 风格的判别联合，调用方必须处理。领域层一律如此。
  - **意外 / 不可恢复**（编程错误、依赖崩了）→ `throw`，由顶层统一捕获、记录、返回 5xx。
- 公共导出必须有显式返回类型（不靠推断）。
- 不用枚举 `enum`（用 `as const` 对象 + 联合类型），除非与外部系统的数值对齐。

## 6. 校验与边界

- **所有外部输入在进入 `application` 层之前用 Zod 校验并转成领域类型**：HTTP body/query/params、外部 API 响应、队列消息、环境变量、DB 读出的 JSON 列。
- Zod schema 放 `packages/shared`，前后端共用同一份（前端做即时校验，后端做权威校验——**后端永远不信任前端**）。
- 环境变量集中在一个 `env.ts` 用 Zod 解析一次，其它地方 import 解析后的对象，不散落 `process.env`。

## 7. 注释与文档

- **每个模块 / 文件顶部**：一段注释说明「这个文件负责什么、属于哪一层、关键不变量」。领域文件额外标注对应的 spec（`// 对应 openspec/.../blessing-delivery`）。
- **函数级 TSDoc**：公共 API、非平凡的函数要有 `/** */`，写清楚：做什么、参数含义、返回什么、什么情况抛错 / 返回错误、有无副作用。
- **行内注释写「为什么」**：为什么用这个算法、为什么这个边界值、为什么绕开某个显而易见的写法、这段代码在防什么坑。**不写复述代码的注释**（`// 循环 items` 是噪音）。
- 每个"看起来不对但其实对"的地方必须有注释（否则下一个人会"修好"它）。
- 关键决策链接回 ADR / spec：`// 见 ADR 0003 §D6`。
- TODO 必须带负责人与条件：`// TODO(beta): 接入真实审核 API 后删除这个 stub 分支`。裸 `// TODO` 评审打回。
- 文档字符串和注释用中文或英文都可以，一个文件内保持一致；面向外部贡献者的包用英文。

### 7.1 注释的语言（硬性）

注释是写给同事看的，就用**同事之间会说的话**：简洁、准确、直白。想象你在白板前跟人讲这段代码，把那句话写下来。

- **要**：短句、主动语态、具体。"先查缓存，命中率大概九成，省一次 DB 往返。" "这里必须是 UTC，因为对账系统按 UTC 切天。"
- **不要**：营销腔和"AI 味"的空话——`leverage` / `utilize`（就说 use / 用）、`delve into` / `in the realm of` / `it is worth noting that` / `elegant solution` / `robust and scalable` / `seamlessly` / `facilitate` / `comprehensive`。不要用一堆形容词堆砌，不要为普通代码写宏大的开场白。
- 不写正确的废话："This function returns a value."
- 不用 emoji、不用感叹号刷存在感、不用装饰性分隔线。
- 中文注释就写正常中文，别翻译腔。
- **评审会因为注释读起来不像人话而打回。** 架构 / 依赖规则的说明文字同样适用。

## 8. 后端 / API

- **Fastify + schema**：每个路由声明 `body` / `querystring` / `params` / `response` 的 JSON Schema（由 Zod 生成），让框架做序列化校验，不在 handler 里手写。
- **handler 薄**：路由 handler 只做「解析请求 → 调 application service → 映射结果到 HTTP」。业务逻辑不在 handler 里。
- **错误 → HTTP 映射集中一处**：领域错误码（`shared` 里的联合）到 HTTP status 的映射写在一个错误处理插件里，handler 不写 `try/catch` 拼 status。
- **幂等**：所有会改状态的非幂等操作（提交祝福、放款）接受 `Idempotency-Key`，服务端去重。
- **分页**：列表接口一律游标分页（`cursor` + `limit`），不用 `offset`。默认 `limit` 有上限。
- **API 版本**：路径前缀 `/api/v1`。破坏性变更起新版本，旧版本有废弃期。
- **可观测性**（见 §12）：每个请求有 `requestId`，结构化日志，关键路径埋点 metric + trace span。
- **配置**：12-Factor，全部走环境变量，`env.ts` 集中解析。不提交任何密钥。
- **超时与重试**：所有出站调用（DB、外部 API）设超时；重试只对幂等操作、带退避和上限；用断路器隔离下游故障。

## 9. 数据库

- **迁移**：Drizzle migrations，版本化、只进不改（改了要新迁移）。每个迁移可回滚或明确标注不可回滚。
- **命名**：表 / 列 `snake_case`，表名复数（`blessings`）。外键 `<referenced_table_singular>_id`。索引 `idx_<table>_<cols>`。
- **约束在数据库**：非空、唯一、外键、check 约束尽量落库——它们是最后一道数据完整性防线。但**业务规则不落库**（不写触发器 / 存储过程实现业务逻辑），业务规则在 `domain`。
- **事务边界在 `application` 层**：一个用例一个事务；`domain` 不知道事务存在。
- **N+1 零容忍**：列表查询用 join 或批量 `where in`。集成测试里断言 SQL 次数。
- **索引**：每个高频查询路径要有覆盖索引；迁移里加索引要在 PR 描述里说明支撑哪个查询。
- **大表**：预估会增长很快的表（`blessing_events`、`reports`）从一开始按时间分区或预留分区方案。
- **不存密钥 / 明文敏感信息**；PII 按 §13 处理。

## 10. 前端

- 函数组件 + Hooks，遵守 [Rules of Hooks](https://react.dev/reference/rules)（ESLint `react-hooks` 强制）。
- **状态分层**：服务端状态用数据获取库（TanStack Query 或等价物）管理，不塞进全局 store；UI 局部状态用 `useState`；真正的跨组件客户端状态才上轻量 store（Zustand 一类）。
- **数据获取集中**：一个 `api` 客户端模块封装 fetch + 错误归一 + 类型（复用 `shared` 的 Zod schema 解析响应）。组件不直接 `fetch`。
- **可访问性**：语义化 HTML，交互元素可键盘操作，图片有 `alt`，颜色对比达 WCAG AA，表单有 label。这是硬要求不是加分项。
- **样式**：CSS Modules，设计 token 用 CSS 变量集中定义。不写全局样式除 reset / token。
- **i18n 从第一天**：所有面向用户的字符串走 i18n 层（即便 P1 只有中文），不硬编码在 JSX 里。
- 组件保持小而专一；超过 ~150 行或有 3+ 职责就拆。
- 列表渲染有稳定 `key`（不是 index，除非列表永不重排）。
- 性能：`memo` / `useMemo` / `useCallback` 只在有实测渲染问题时加，并注释原因；默认不加。

## 11. 并发与性能

**Node 并发模型**——必须理解并遵守：

- Node 是**单线程事件循环**。ToC API 绝大多数工作是 IO（DB、外部 API），事件循环模型正合适。
- **绝不阻塞事件循环**：不在请求路径做同步 CPU 密集操作（大 JSON 解析循环、加密、图片/音视频处理、复杂正则回溯）。这类工作：
  - 短的 → `worker_threads` 线程池；
  - 重的 / 长的 → **独立服务或队列 worker**（转码、ML 推理、批量导出都属此类，见 ADR 0003）。
- **流式处理**：大响应 / 大文件用 stream，不整体加载进内存。注意背压（backpressure）。
- **连接池**：DB 连接池大小按 `(核数 × 2) + 有效磁盘数` 起调，压测校准；每个实例的池上限 × 实例数不能超过 PG `max_connections`，必要时上 PgBouncer。
- **批处理与去重**：同一 tick 内对同一资源的多次读用 DataLoader 式批量合并。
- **缓存**：只在有数据支撑时加；缓存要有明确失效策略和"陈旧可容忍度"的判断；分布式缓存（Redis）用于跨实例共享，进程内缓存只用于不变数据。缓存击穿 / 雪崩要防。
- **背压与限流**：入站有全局并发上限和按用户限流；出站有断路器。

**性能纪律**：

- 不做无数据支撑的优化（"这样可能更快"不是理由）。先测（`clinic`、`0x`、Chrome DevTools、PG `EXPLAIN ANALYZE`），定位真实瓶颈，改，再测确认。
- 每个 PR 涉及热路径 / 新查询，描述里说明预期复杂度和数据量级。
- 关键接口有 p50/p95/p99 延迟 SLO，CI 里有基准（benchmark）回归防护。
- 数据库是最常见的瓶颈：先看查询计划和索引，再谈别的。

## 12. 错误处理与可观测性

- **结构化日志**（JSON），字段固定：`ts`、`level`、`requestId`、`userId?`、`event`、`msg`、`durationMs?`、`err?`。用 `pino`。
- **`requestId` 全链路透传**（HTTP header → 日志 → 出站调用 header → 队列消息）。
- **不吞错误**：`catch` 里要么处理、要么带上下文重抛、要么记录后按业务决定降级。空 `catch {}` 评审阻断。
- **错误分类**：`shared` 里维护错误码联合（`BlessingNotFound`、`ModerationUnavailable`…）。日志和 metric 按错误码聚合。
- **Metrics**：请求量 / 错误率 / 延迟分布（RED），关键业务指标（祝福提交数、审核队列长度、hold 时长分布）。
- **Tracing**：OpenTelemetry，跨服务 span。
- **告警**：错误率、延迟、队列积压、审核 hold 超时有阈值告警。

## 13. 安全与隐私

- **后端不信任任何客户端输入**（§6）。所有 SQL 走参数化 / ORM，禁止字符串拼 SQL。
- **鉴权在 `application` 层显式检查**："这个用户能不能对这个资源做这个操作"是一次显式调用，不靠路由前缀隐含。
- **最小权限**：DB 账号、对象存储凭证、第三方 token 都按服务/ 环境最小授权。
- **密钥**：只从环境 / 密钥管理服务读，不进代码库、不进日志、不进错误信息。CI 有密钥扫描。
- **PII / 敏感个人信息**（PIPL）：人脸 / 声纹 / 信仰相关信息按 [调研报告](../research/2026-09-01-funds-ai-licensing.md) 领域三——最小化采集、单独同意、可删除、日志脱敏。落地页不下发 openid / 精确位置 / 手机号。
- **依赖**：`pnpm audit` 在 CI；新增依赖走 AGENTS.md §4.4 的门槛（先问标准库 / 现有代码能不能做）。锁定版本，定期升级。
- **限流 / 防滥用**：登录、提交、举报等接口有速率限制和异常检测。

## 14. 测试

- **TDD**：改 bug 先写会失败的测试（AGENTS.md §4.3）。新功能优先测试先行。
- **分层测试策略**（每层一套，彼此独立，可单独跑）：
  - **架构测试**（`test:arch`）：dependency-cruiser + `*.arch.test.ts`，见 §3.1。独立命令、CI 独立一步、最先跑。
  - `domain`：纯单元测试，覆盖每条 spec scenario（一个 scenario ≈ 一个 test）。要求高覆盖（分支 ≥ 90%）。
  - `application`：用例测试，port 用测试替身（in-memory fake，不用 mock 框架堆断言）。
  - `infrastructure`：集成测试，打真实 PG（testcontainers / 本地测试库），覆盖幂等、唯一约束、事务、N+1。
  - `interface`：少量 API 层测试（校验、错误映射、鉴权）。
  - E2E：Playwright，覆盖关键用户旅程（登录→撰写→送达→撤回…），数量克制。
- 各套用独立的 vitest project / 配置，命令分开（`test:arch` / `test:unit` / `test:integration` / `test:e2e`），CI 分步跑，`test` 聚合全部。
- 测试名描述行为，不描述实现：`it('撤回后访客看到已被收回，坚持记录回撤')`。
- **不允许 flaky 测试**：时间用可注入的 `Clock`，随机用可注入的种子，不 `sleep`。
- 测试数据用 builder / factory，不用共享可变 fixture。
- CI 红了不合并。覆盖率下降要在 PR 里解释。

## 15. 依赖管理

- 加依赖前先问：标准库 / 已有依赖 / 自己写 20 行能不能做？（AGENTS.md §4.4）确需要，在 PR 描述里说明为什么、评估了哪些替代、维护活跃度和体积。
- 锁 lockfile，CI `--frozen-lockfile`。
- 优先选：类型自带、无 / 少传递依赖、活跃维护、体积合理的。
- 定期（每月）跑升级 + audit，安全补丁及时上。

## 16. 提交与分支

- 单开发者仓库，直接在 `main` 上工作，**每轮对话结束自动 commit + push**（见 AGENTS.md §7 与 `.claude/hooks/`）。
- Commit message：[Conventional Commits](https://www.conventionalcommits.org/)。`<type>(<scope>): <subject>`，subject 用祈使句、≤ 72 字符；正文说明「为什么」和影响面；结尾 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 一次 commit 是一个逻辑变更。夜间大批量工作可以一次 commit，但 message 要说清楚包含哪些块。
- 引入协作者后改为 PR + 评审 + CI 门禁（另开 ADR）。

## 17. 评审清单（reviewer 逐条过）

- [ ] 分层依赖方向对不对？有没有 `domain` 依赖框架 / IO？
- [ ] 外部输入都校验了吗？后端有没有信任前端？
- [ ] 错误有没有被吞？失败路径测了吗？
- [ ] 有没有阻塞事件循环的同步重活？
- [ ] 有没有 N+1 / 缺索引 / `offset` 分页？
- [ ] 注释解释了「为什么」而不是复述代码？"看起来不对但其实对"的地方有注释吗？
- [ ] 命名能读懂吗？有没有 `any` / 无理由的 `as` / `!`？
- [ ] 鉴权检查是显式的吗？PII 处理对吗？
- [ ] 测试覆盖了新增 spec scenario 吗？测试名描述行为吗？
- [ ] commit message 规范、说清了「为什么」吗？
- [ ] diff 是不是最小的（没有顺手重构、没有 Kitchen Sink）？（AGENTS.md §4）
