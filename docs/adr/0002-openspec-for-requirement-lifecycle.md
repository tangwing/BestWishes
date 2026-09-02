# 2. 用 OpenSpec 管理需求生命周期（Spec → 评审 → TDD → 实现）

Date: 2026-09-01

## Status

Accepted

## Context

用户要求：每一个推动产品演进的需求，都要经过「写 Spec → 评审 → 基于 Spec 生成测试用例（TDD）→ 实现直到测试通过」的完整流程，且全程可追溯——目标是这个 APP 未来可能面向上亿用户，质量要求按最高水准把控。用户要求调研 OpenSpec 或同类工具，不要从零发明一套流程。

调研并核验（GitHub star/fork/最近提交、实际 `npx` 跑通 init）了三个候选：

- **OpenSpec**（Fission-AI/OpenSpec）：66.8k★，今天仍有提交。每个需求是一个独立的 change 目录（`proposal.md` + `specs/<capability>/spec.md` + `design.md` + `tasks.md`），完成后 `archive` 归档保留全部历史。粒度贴合"单个需求"。
- **spec-kit**（GitHub 官方）：132.6k★，更热门，但围绕 constitution→specify→plan→tasks，粒度偏整项目/整功能级，不如 OpenSpec 贴合"一个需求一个流程"。
- **BMAD-Method**：52.5k★，多 agent 角色扮演、重流程，风格与本仓库 AGENTS.md 强调的"克制、纪律驱动"不契合。

三者的评审门和 TDD 强制目前都只是 **prompt 级约定**，不是机制性硬卡（CI/工具层面阻止未评审代码落地）——这与本仓库 AGENTS.md 现有的代码工艺标准（如"bug 先写会失败的测试"）本质上是同一类纪律：靠 agent 自律执行，不靠工具强制。

## Decision

1. 采用 **OpenSpec** 作为本仓库的需求生命周期管理工具，叠加在现有 AGENTS.md 规范之上，不替代它。已执行 `openspec init --tools claude`，生成 `openspec/` 目录与 `.claude/commands/opsx/*`、`.claude/skills/openspec-*` 系列 Skill/slash command；已全局 `npm install -g @fission-ai/openspec@latest` 使 `/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等命令可用。
2. `openspec/config.yaml` 的 `context` 字段复述了 AGENTS.md 的关键约束（外科式改动、根因调试、依赖纪律、可追溯性等），确保只读 openspec 目录的 AI 也不会漏掉工程规范。
3. **评审门与 TDD 暂不做机制化强制**，维持 prompt 级约定，与仓库现有风格一致。技术栈与测试框架选定后，再评估是否需要 CI 层面的硬性检查（例如要求 diff 中包含"先失败后通过"的测试记录）。
4. **PROMPT_LOG.md / CHANGELOG.md 与 OpenSpec 的 `openspec/changes/`→归档记录并行存在，不合并**：PROMPT_LOG 记原始用户 prompt，CHANGELOG 记版本变更，OpenSpec 的 change 归档记单个需求的 spec/评审/任务细节，三者分工不同、各自维护。

## Consequences

- 后续每个具体产品需求，原则上应通过 `/opsx:propose` 起草 change（proposal + spec + design + tasks），经讨论确认后再 `/opsx:apply` 进入实现，完成后 `/opsx:archive` 归档。
- AGENTS.md §5 目录约定表需要补充 `openspec/` 与 `.claude/` 两行（已同步更新）。
- 若未来发现 prompt 级约定不足以保证质量（例如出现"未评审就实现"的情况），需要新开 ADR 记录升级为机制化强制的决定，而不是回来修改本条。
