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

**P1（文本静心祝福）初版 Demo 可跑。** 产品北极星、用例、架构、技术栈（[ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md)：Web-first）、工程规范都已成文。生产 monorepo 里 `packages/domain` + `server/`（Fastify）+ `client/`（React）已把 P1 完整链路跑通——见下方「跑 Demo」和 [docs/DEMO.md](docs/DEMO.md)。数据层现为内存实现，PostgreSQL、真实微信授权、真实内容审核 API 见 [BACKLOG.md](BACKLOG.md)。

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
```

## 跑 Demo

**单进程**（server 托管 build 好的 client）：

```bash
pnpm demo                # http://127.0.0.1:3000
```

**开发模式**（server + Vite HMR）：

```bash
pnpm dev                 # client http://localhost:5173，API 代理到 :3000
```

走查一遍：登录 → 个人空间设落款/城市 → 同意协议 → 写一段祝福（试试粘贴，会被拦）→ 已发送（等几秒审核）→ 打开分享链接看正文 → 收发记录里撤回 → 再看链接变占位。详见 [docs/DEMO.md](docs/DEMO.md)。

数据存在内存里，重启即清空。

走查原型（独立、将移除）：`cd prototype && npm install && npm run dev`
