#!/usr/bin/env bash
# Stop hook — 每轮对话结束后自动 commit + push，保证单人仓库实时同步到远端。
# 见 AGENTS.md §7。Claude 通常已在本轮内自己提交（带清晰 message），本脚本是兜底。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# 有未提交改动才提交
if ! { git diff --quiet && git diff --cached --quiet \
       && [ -z "$(git ls-files --others --exclude-standard)" ]; }; then
  git add -A
  scope=$(git diff --cached --name-only \
    | awk -F/ '{ print ($1 == $0 ? "(root)" : $1) }' \
    | sort -u | paste -sd "," -)
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  git commit -q \
    -m "chore: sync session changes (${scope})" \
    -m "Automated Stop-hook fallback commit at ${ts}. Claude normally commits with a descriptive message earlier in the turn." \
    -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" || true
fi

# 本地已领先远端才推送
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1 || exit 0
[ -z "$(git rev-list '@{u}..HEAD' 2>/dev/null)" ] && exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new"

( git push -q origin "HEAD:${branch}" 2>/dev/null || git push -q 2>/dev/null ) &
push_pid=$!
for _ in $(seq 1 40); do kill -0 "$push_pid" 2>/dev/null || break; sleep 1; done
if kill -0 "$push_pid" 2>/dev/null; then
  kill -9 "$push_pid" 2>/dev/null
  printf '{"systemMessage":"auto-commit-push: 已本地提交，push 超时(>40s)，稍后手动 push。"}\n'
elif ! wait "$push_pid"; then
  printf '{"systemMessage":"auto-commit-push: 已本地提交，push 失败(检查网络/凭证)。"}\n'
fi
exit 0
