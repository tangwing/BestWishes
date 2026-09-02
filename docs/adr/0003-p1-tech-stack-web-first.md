# 3. P1 技术栈：Web-first（H5 + PWA）

Date: 2026-09-01（决策项表补充于 2026-09-02）

## Status

**Accepted（核心项）** — 2026-09-02 用户逐条选择。影响架构、难回退的 5 项已定（D1/D4/D6/D9/D10）；其余 6 项按 ★倾向执行、实现时可微调（D2/D3/D5/D7/D8/D11），用户未反对。D12/D13 推迟。
AGENTS.md §1「技术栈未定」与 §6「技术栈」条目据此更新。

## 决策记录（2026-09-02）

| 项 | 选定 | 备注 |
|---|---|---|
| D1 整体形态 | **A · Web-first PWA** | 微信内 H5，任意浏览器可访问 |
| D2 前端框架 | A · React + TS + Vite（倾向，未反对） | 原型已验证 |
| D3 前端样式 | B · CSS Modules（倾向，未反对） | 原型已用 |
| D4 后端语言 | **A · Node.js + TypeScript** | 领域模块前后端共享 |
| D5 后端框架 | A · Fastify（倾向，未反对） | 可换 Express |
| D6 数据库 | **A · PostgreSQL** | 提前落地为 P3 资金一致性铺路 |
| D7 数据访问 | A · Drizzle ORM（倾向，未反对） | — |
| D8 仓库结构 | A · pnpm monorepo（倾向，未反对） | `client/`+`server/`+`packages/domain/` |
| D9 微信登录 | **A · 网页授权 OAuth2 + JS-SDK** | 由 D1=A 锁定 |
| D10 审核真实 API | **B · P1 用规则实现，真实 API 放 P1 收尾 / P2** | 接口已抽象，切换零改动；P1 就建人工校准集补漏判 |
| D11 审核后台 | A · 内嵌主应用（倾向，未反对） | — |
| D12 生产托管 | 推迟 | apply 前再定 |
| D13 小程序 | 推迟 | 触发条件见下 |

> D2/D3/D5/D7/D8/D11 若要调整，在评审 openspec change 时一并提出即可。

## Context

- P1 范围已锁定（[use-cases.md](../product/use-cases.md)）：仅文本祝福，**访客免注册查看**是硬需求 → 祝福落地页必须是任意浏览器可打开的普通 Web 页面。
- P1 不涉及录音（P2）、不涉及支付（P3）。
- 领域逻辑（祝福状态机、坚持记录、审核判定）已在 [prototype/](../../prototype/) 用 TypeScript 写成纯函数模块，设计上可跨端复用。
- 目标规模上亿用户，但 P1 是验证核心体验循环的 MVP；选型优先"能快速验证、可长期演进"，不做过度工程（AGENTS.md §2 最简方案）。
- 完整对比见 2026-09-01 对话记录与 [use-cases.md](../product/use-cases.md) 的「首发客户端」一节。

## 决策项（请逐条选择）

> 回复方式：对每项回 `A` / `B` / … 或「按倾向」。标 ★ 的是我的倾向。

### D1 · 整体形态　（影响：全部 · 可逆性：低）

- **A ★ Web-first**：一套响应式 Web 应用（PWA），微信内以 H5 打开，任意浏览器可访问。
- B　微信小程序优先。
- C　混合：小程序做创作端 + H5 做访客落地页。

倾向 A 的理由：P1 用不到小程序的唯一硬优势（录音、复访位）；Web-first 访客零门槛、发版无审核、可演进到多端。

### D2 · 前端框架　（影响：前端全部、招聘 · 可逆性：低-中）

- **A ★ React + TypeScript + Vite**
- B　Vue 3 + Vite
- C　Svelte / SvelteKit
- D　SolidJS

倾向 A：生态与招聘面最广；与未来 React Native（如需原生 App）共享心智；协作成本低。原型已用 A。

### D3 · 前端样式方案　（影响：中 · 可逆性：高）

- A　Tailwind CSS
- **B ★ CSS Modules**（原型已用；"正念克制"的定制视觉，避免 utility class 噪音）
- C　vanilla-extract / Panda（零运行时 CSS-in-TS）

### D4 · 后端语言 / 运行时　（影响：后端全部、招聘、领域逻辑复用 · 可逆性：低）

- **A ★ Node.js + TypeScript**
- B　Go
- C　Python（FastAPI）
- D　Bun + TypeScript

倾向 A：与前端同语言 → 领域模块（状态机等，已是 TS）零成本前后端共享；招聘面广；P1 无重计算。Go 的性能/并发优势 P1 用不上且起步慢。

### D5 · 后端 HTTP 框架　（影响：中 · 可逆性：中）

- **A ★ Fastify**（轻、快、schema 校验内建）
- B　Express（最普及，中间件生态大）
- C　NestJS（重，DI + 装饰器，团队大时有价值）
- D　Hono（极轻，边缘友好）

### D6 · 数据库　（影响：数据层、运维、P3 资金一致性 · 可逆性：低）

- **A ★ PostgreSQL**
- B　MySQL
- C　SQLite 起步 → 之后迁 PG
- D　MongoDB

倾向 A：P1 数据关系清晰，状态机 / 事务用关系型约束最直接；P3 悬赏分账对一致性要求高，提前落 PG 免迁移；生态成熟。

### D7 · 数据访问层　（影响：中 · 可逆性：中）

- **A ★ Drizzle ORM**（TS 原生、贴近 SQL、类型强）
- B　Prisma（schema DSL、迁移工具最成熟）
- C　Kysely（纯 query builder）
- D　裸 SQL + `pg`

### D8 · 仓库结构　（影响：中 · 可逆性：中）

- **A ★ 单仓 monorepo**：pnpm workspaces，`client/` + `server/` + `packages/domain/`（前后端共享领域模块）。
- B　前后端分仓。

倾向 A：领域模块需前后端共享；团队还小。注意：需要把包管理从 npm 换成 pnpm（原型现用 npm）。

### D9 · 微信登录接入　（影响：中 · 可逆性：中）

- **A ★ 网页授权 OAuth2 + JS-SDK**（若 D1=A，这是必然）
- B　小程序 `wx.login`（若 D1=B/C）

需要：微信开放平台 / 公众号主体 + appid/secret。P1 验收阶段可用 stub 实现顶替，真实接入放 apply 阶段。

### D10 · 内容审核真实 API 的采购时点　（影响：小，接口已抽象 · 可逆性：高）

- **A ★ P1 就接一家云内容安全**（阿里云 / 腾讯云 / 网易易盾，见调研报告领域二）
- B　P1 用规则实现，真实 API 放 P1 收尾或 P2

倾向 A：审核是安全底线，纯规则漏判率高。但需要企业主体 + 账号 + 预算。若主体/账号一时不到位，退 B。

### D11 · 审核后台形态　（影响：小 · 可逆性：高）

- **A ★ 内嵌主应用**（同一前端，路由 + 角色区分）
- B　独立前端应用

### D12 · 生产托管　→ 推迟

P1 代码本地可跑 + 可容器化即可。云厂商、域名、对象存储是独立决策，不阻塞 P1 验收与实现，apply 阶段前再定。

### D13 · 小程序　→ 推迟

触发条件：P2 录音在 H5/PWA 真机（尤其 iOS Safari / 微信内嵌浏览器）实测体验不达标，或分发数据证明小程序入口不可替代。届时新开 ADR，尽量复用 P1 的 `packages/domain`。

## Decision

见上方「决策记录」表。一句话：**Web-first PWA（React+TS+Vite，CSS Modules）+ Node.js+TS（Fastify）+ PostgreSQL（Drizzle）+ pnpm monorepo，领域逻辑放 `packages/domain` 前后端共享；微信网页授权；P1 内容审核用规则实现（真实云 API 收尾 / P2 接入）；审核后台内嵌；生产托管与小程序推迟。**

[prototype/](../../prototype/) 已按其中前端相关项（React+TS+Vite、CSS Modules、TS 领域模块）落地，是这套选型的可运行验证。

### 长期适配性核验（2026-09-02）

- **规模（目标上亿用户）**：无状态 Node API + 负载均衡水平扩展；PostgreSQL 通过读副本 / 分区 / 后续 Citus 或迁 CockroachDB 有明确扩展路径。领域逻辑隔离在 `packages/domain`，API 层可替换。
- **P2 音视频 + AI**：媒体转码 / 存储 / CDN 是与语言无关的基础设施。AI/ML 工作负载（ASR 用 FunASR/Paraformer、LLM 评估、liveness）**作为独立服务**（多为 Python / 原生），由 Node API 经 HTTP/gRPC 调用——这是刻意的多语言微服务拆分，不是 Node 的限制。
- **P3 资金**：一致性关键的账本落在 PostgreSQL 事务里；Node 负责编排支付渠道 API。
- **并发模型**：ToC API 以 IO 密集为主（DB、外部 API），Node 事件循环正合适；CPU 密集（转码、ML）不进 API 进程，走独立服务 / 队列 worker。详见 [docs/engineering/coding-standards.md](../engineering/coding-standards.md) §并发与性能。
- **灵活性保留点**：领域逻辑可跨端复用（RN / 小程序 / 甚至他语言重写）；`ModerationProvider` 式可插拔接口延用于 ASR/liveness/支付；monorepo 便于加服务；PostgreSQL 可移植。
- **唯一显著取舍**：API 热路径若将来需要极致单核计算，Node 弱于 Go/Rust——但本产品工作负载不是这样，且真到那天可把某个服务单独用 Go 重写而不动其余。

结论：**这套选型满足可预见的长期需求并保留了灵活性，可以推进。**

## Consequences

- P1 落地页天然满足"访客免注册"；无小程序审核周期拖慢迭代。
- 领域逻辑（`packages/domain`）与前端框架、后端框架解耦，为"是否引入小程序 / 原生 App"留复用空间。
- `ModerationProvider` 这类"可插拔第三方能力"接口模式，后续 ASR / liveness / 支付分账接入延用。
- P2 录音能力需专门验证 H5 端 `MediaRecorder` / JS-SDK 在真机的可用性；不达标则触发 D13。
- 采用 pnpm monorepo 意味着原型的 npm 结构在正式建 `client/`+`server/` 时要迁移（工作量小）。
- 本 ADR Accept 后，AGENTS.md §1 的"技术栈未定"状态解除。
