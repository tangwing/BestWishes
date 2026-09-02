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

**P1 设计与拆分中。** 产品北极星、P1（文本静心祝福）用例、后端能力清单、P1 架构、openspec 需求拆分均已成文并待评审；技术方向见 [ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md)（Web-first，Proposed）。`prototype/` 有一个可运行的走查原型（spike）。生产 `client/` `server/` 待评审通过后进入 apply 阶段。

## Repo layout

```
README.md            本文件
AGENTS.md             工程规范与 AI 协作约定（唯一事实来源）
CLAUDE.md             桥接文件，指向 AGENTS.md
CHANGELOG.md          版本变更记录
PROMPT_LOG.md          驱动本项目演变的用户 prompt 完整记录
docs/product/          产品概念、北极星、用例、能力清单
docs/research/         调研报告（合规 / AI / 技术选型的决策输入）
docs/architecture/     架构设计
docs/adr/              架构决策记录（Architecture Decision Records）
docs/design/           界面设计走查稿
openspec/              需求生命周期（Spec/评审/任务），见 ADR 0002
prototype/             P1 走查原型（spike，非生产代码）
.claude/               Claude Code Skill / slash command
```

## Getting started

生产代码尚未开始。走查原型：

```bash
cd prototype
npm install
npm test        # 领域逻辑 + 集成 + 页面冒烟
npm run dev     # http://localhost:5173
```
