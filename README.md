# BestWishes

> 项目名暂定，待定案。

一个让人们互相发布、悬赏、赠送「祝福」的多端平台。

## Goal

打造一款多端可用的 APP：

- 用户可以发布「希望收到的祝福」（例如生日、节日、鼓励等），并可为其设置悬赏
- 任何人都可以响应他人的祝福请求，或主动向他人送出祝福
- 平台在多个终端（暂定，具体端在技术选型阶段确定）上均可使用

细节需求、目标用户、变现方式等仍在澄清中，见 [docs/product/concept.md](docs/product/concept.md)。

## Status

**Scaffolding.** 技术栈尚未选定，当前只有目录结构和工程规范。技术选型讨论记录在 [docs/adr/](docs/adr/)。

## Repo layout

```
README.md          本文件
AGENTS.md           工程规范与 AI 协作约定（唯一事实来源）
CLAUDE.md            桥接文件，指向 AGENTS.md
CHANGELOG.md         版本变更记录
PROMPT_LOG.md         驱动本项目演变的用户 prompt 完整记录
docs/product/         产品概念与需求
docs/adr/              架构决策记录（Architecture Decision Records）
```

客户端、服务端等代码目录将在技术栈选定后建立。

## Getting started

技术栈未定，暂无构建/运行步骤。
