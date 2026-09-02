#!/usr/bin/env bash
# Stop hook — 每轮对话结束后自动 commit + push，保证单人仓库实时同步到远端。
# 见 AGENTS.md §7。Claude 通常已在本轮内自己提交（带清晰 message），本脚本是兜底。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0

# 不是 git 仓库 → 什么都不做
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# 没有任何改动 → 什么都不做
if git diff --quiet && git diff --cached --quiet \
  && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

git add -A

# 概要：哪些顶层目录 / 根文件变了
scope=$(git diff --cached --name-only \
  | awk -F/ '{ print ($1 == $0 ? "(root)" : $1) }' \
  | sort -u | paste -sd "," -)
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

git commit -q \
  -m "chore: sync session changes (${scope})" \
  -m "Automated Stop-hook commit at ${ts}. Claude usually commits with a descriptive message earlier in the turn; this is the fallback." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
export GIT_TERMINAL_PROMPT=0
if ! git push -q origin "HEAD:${branch}" 2>/dev/null && ! git push -q 2>/dev/null; then
  printf '{"systemMessage":"auto-commit-push: 已本地提交，但 push 失败（检查网络 / 凭证）。"}\n'
fi
exit 0
