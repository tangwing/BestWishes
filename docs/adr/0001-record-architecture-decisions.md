# 1. 用 ADR 记录架构决策

Date: 2026-08-31

## Status

Accepted

## Context

本项目会做一系列影响长期结构的决策（技术栈、多端实现方式、后端架构、数据模型等）。这些决策的"为什么"比"是什么"更容易随时间丢失。

## Decision

用 [Architecture Decision Records](https://adr.github.io/) 记录重大、难以逆转的技术决策。每条决策一个文件：`NNNN-简短标题.md`，编号递增，已合并的记录不做回溯性修改——需要变更时新增一条并引用被取代的旧记录。

## Consequences

后续技术选型（语言/框架、多端策略、后端架构、数据存储等）讨论定案后，在此追加 ADR，而不是只存在于对话记录或 README 里。
