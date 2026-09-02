# BestWishes

Best wishes for you and for the world.

> 项目名暂定，待定案。

一个让人们互相发布、悬赏、赠送「祝福」的多端平台。

## Goal

打造一款多端可用的 APP：

- 用户可以发布「希望收到的祝福」（例如生日、节日、鼓励等），并可为其设置悬赏
- 任何人都可以响应他人的祝福请求，或主动向他人送出祝福
- 平台在多个终端（暂定，具体端在技术选型阶段确定）上均可使用

细节需求、目标用户、变现方式等仍在澄清中，见 [docs/product/concept.md](docs/product/concept.md)。

## Status

**P1（文本静心祝福）实现中。** 产品北极星、用例、架构、技术栈（[ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md)：Web-first）、工程规范都已成文。正在把 P1 从走查原型（`prototype/`）迁到生产 monorepo，按 [BACKLOG.md](BACKLOG.md) 的循环推进直到初版 Demo。

## Repo layout

```
README.md · AGENTS.md · CLAUDE.md · CHANGELOG.md · PROMPT_LOG.md · BACKLOG.md
docs/product/     产品概念、北极星、用例、能力清单
docs/research/    调研报告（合规 / AI / 技术选型）
docs/architecture/ 架构设计
docs/adr/         架构决策记录
docs/design/      界面设计走查稿
docs/engineering/ 工程规范（所有代码必须遵循）
openspec/         需求生命周期（Spec / 评审 / 任务），见 ADR 0002
packages/domain   纯领域逻辑（无 IO / 无框架）
packages/shared   跨端类型 / Zod schema / 错误码
server/           Node + Fastify（分层 interface/application/infrastructure/ports）
client/           React + Vite（PWA）
arch/             架构测试
prototype/        P1 走查原型（spike，功能对齐后移除）
```

## Getting started

```bash
corepack enable          # 启用 pnpm
pnpm install
pnpm verify              # typecheck + 架构测试 + 全部测试 + build
pnpm dev                 # server + client 一起起
```

走查原型（独立）：`cd prototype && npm install && npm run dev`
