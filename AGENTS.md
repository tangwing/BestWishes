# Agent Operating Manual — BestWishes

本仓库的唯一事实来源。任何 AI、任何模型、任何平台，进入本仓库前先读本文件。

**每次会话开始，读本文件 + [BACKLOG.md](BACKLOG.md)。** BACKLOG.md 的「恢复点」一节说明当前进展和下一步——会话或电脑重启后从那里接着干。

本项目是一个正规软件工程项目（非个人知识库/记忆系统），按标准软件开发者的要求组织：清晰的目录结构、可追溯的决策记录、代码工艺标准。

## 1. 项目状态

产品概念与北极星已立（[docs/product/vision.md](docs/product/vision.md)）。当前在做 **P1（文本静心祝福）** 的需求拆分与实现准备。

P1 技术栈已定（[ADR 0003](docs/adr/0003-p1-tech-stack-web-first.md)）：**Web-first PWA（React + TypeScript + Vite）+ Node.js + TypeScript（Fastify）+ PostgreSQL + pnpm monorepo**，领域逻辑放 `packages/domain` 前后端共享。所有代码必须遵循 [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md)。

P2 及以后的技术决策（音视频管线、AI/ML 服务、多端原生）仍未定，不要提前假设。

## 2. 质量标准

- **目标驱动**：不做无法验证的工作。开始前明确验收标准。README 的 Goal 一节是当前最高层目标；模糊需求先澄清，不要猜测后静默执行。
- **最简方案**：用最少的活动部件解决问题。不为假设中的未来需求做设计。
- **可追溯性**：每个推动项目演变的用户 prompt 记录在 [PROMPT_LOG.md](PROMPT_LOG.md)。重大架构决策记录为 [docs/adr/](docs/adr/) 下的 ADR。
- **完成 = 已同步**：代码写完、文档更新、CHANGELOG 记录、commit 完毕，才算完成。未提交的工作是未完成的工作。
- **待办进 [BACKLOG.md](BACKLOG.md)，完成的进 [CHANGELOG.md](CHANGELOG.md)。** 用户按点评方式提改动时，先记进 BACKLOG，再逐条做。每轮结束把做完的从 BACKLOG 挪到 CHANGELOG。BACKLOG 要随时能当作恢复点。

## 3. 协作模型

- **伙伴而非主仆**：遇到真正的歧义、或涉及不可逆/超出当前范围的决策时主动询问；不要静默猜测执行。
- **意图优先于字面指令**：用户的话描述的是想要什么，不一定是怎么做。可以且应该提出更好的方案。
- **反馈即校准**：用户的修正是方向信号，提炼出背后的原因（WHY），而不只是记住"改了什么"。

## 4. 代码工艺标准（写/改代码时生效）

核心命题：模型擅长快速生成"看似合理"的代码，却迟于发现"合理 ≠ 正确"。以下纪律由流程承担，不靠临场自觉。

1. **外科式改动（最高优先级）**：只动被要求的范围。不顺手重构、不"既然来了就改一下"。diff 越小越好——小到正好解决问题。
2. **调试治根因，不糊症状**：先读完整报错/栈信息，复现后再动手。一次只改一处，改完验证再改下一处。症状消失 ≠ 根因解决。
3. **改 bug 先写会失败的测试**：修复前先写一个能复现该 bug、当前会失败的测试，作为"确实修中了因"的证据。
4. **依赖即永久代码**：加依赖前先问：标准库/项目里已有的能不能做到？确需要加时，说明为什么。
5. **写之前先读，简单优先**：动手前先读要改的文件，复用已有模式。抵制过早抽象——唯一理由是"以防将来要用"的抽象就是过度设计。
6. **收尾前自检失败模式**：借机重构了半个 codebase（Kitchen Sink）/ 只处理了 happy path（Optimistic Path）/ 修复像滚雪球一样级联到一堆文件（Runaway Refactor）——发现自己落入任一种，正确动作是停下，不是硬推。

> Source: 借鉴 A. Karpathy《CLAUDE.md: Field Notes》，并延续作者「ls」个人 AI 助理仓库的代码工艺标准。

## 5. 目录约定

| 内容类型 | 位置 |
|---|---|
| 待办事项 + 工作恢复点 | `BACKLOG.md`（根目录） |
| 产品概念/需求 | `docs/product/` |
| 调研报告（架构/合规/技术选型的决策输入） | `docs/research/`，按 `YYYY-MM-DD-主题.md` 命名，只增不改 |
| 架构设计（跨模块的技术方案） | `docs/architecture/` |
| 界面设计走查稿（Claude Design 画布工作文件） | `docs/design/` |
| 架构决策记录 | `docs/adr/`，新增决策用下一个编号新建文件，不修改已合并的旧决策 |
| 用户 prompt 完整记录 | `PROMPT_LOG.md` |
| 版本变更 | `CHANGELOG.md`（Keep a Changelog 格式） |
| 需求生命周期（Spec/评审/任务，见 [ADR 0002](docs/adr/0002-openspec-for-requirement-lifecycle.md)） | `openspec/`，通过 `/opsx:propose` `/opsx:apply` `/opsx:archive` 等 slash command 操作 |
| 工程规范（代码风格、架构、注释、性能） | `docs/engineering/`，所有代码必须遵循 |
| Claude Code Skill/slash command | `.claude/` |
| P1 走查原型（spike，非生产代码，将在 monorepo 达到功能对齐后移除） | `prototype/`，见其 README |
| 生产代码（pnpm monorepo） | `packages/domain`（纯领域逻辑）· `packages/shared`（跨端类型 / Zod schema / 错误码）· `server/`（Node + Fastify，分层 interface/application/infrastructure/ports）· `client/`（React + Vite）· `arch/`（架构测试）。跑 `pnpm verify` |

## 6. 尚未决定，需要与用户共同澄清

- 多端原生实现方式（P2 之后：原生 × N / 跨端框架 / 继续 Web）；微信小程序（P2 录音实测后决策，见 ADR 0003 §D13）
- P2 音视频管线与 AI/ML 服务的具体选型
- 悬赏机制的具体规则（谁出资、如何托管、如何验收）——见调研报告 ADR-A…ADR-G
- 变现模式
- 目标平台清单

不要在这些问题上替用户拍板并动手写产品代码；讨论清楚、写入 ADR 后再开始实现。

## 7. Git 工作流

- 单开发者仓库。**每轮对话结束自动 `commit` + `push` 到 `main`**（`.claude/hooks/auto-commit-push.sh`，Stop hook），保证工作实时同步到远端。
- Claude 在每轮结束前应先自己用清晰、准确、符合 Conventional Commits 的信息提交；hook 是兜底（漏提交时用概要信息补一笔）。
- commit message 规范：`<type>(<scope>): <subject>`，type ∈ feat/fix/docs/refactor/test/chore/build，正文说明「为什么」，结尾带 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。

## 8. 工作方式

- **点评式迭代**：用户会针对设计稿 / spec 逐点提改动。每一点先记进 [BACKLOG.md](BACKLOG.md)（给个 `B-NN` 编号），再逐条落地——同步改 spec、画布、原型三处，保持一致。迭代快，不必每步都等确认；有真正的歧义或不可逆决策才停下问。
- **并行**：条件允许时派多个 subagent 并行推进相互独立的块（如"改原型" vs "改 spec" vs "调研"）。派之前把共同的决策写清楚（BACKLOG 或 agent prompt 里），避免各做各的对不上。彼此有依赖或会改同一批文件的，不要并行。
- **恢复**：任何时候都假设下一秒会话可能重启。重要进展随时落 BACKLOG「恢复点」+ commit。
