#!/usr/bin/env bash
# Stop hook — 每轮结束后，若代码有变化，自动重启 demo 服务，方便用户随时在浏览器测最新代码。
# 见用户 2026-09-19 的要求。跟 auto-commit-push.sh 一样是 Stop hook，但互不依赖：
# 判断"有没有变化"看的是工作区文件本身（HEAD + git status），不管有没有提交。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

STATE_DIR=".claude/.demo-state"
mkdir -p "$STATE_DIR"
MARKER="$STATE_DIR/last-signature"
LOGFILE="$STATE_DIR/demo.log"
DEMO_PORT=3000

# 签名 = 当前 commit + 工作区改动状态；不变就说明这轮没碰代码，不用重启打断用户正在测的 demo。
sig="$(git rev-parse HEAD 2>/dev/null)
$(git status --porcelain 2>/dev/null)"
last_sig=""
[ -f "$MARKER" ] && last_sig="$(cat "$MARKER")"
[ "$sig" = "$last_sig" ] && exit 0

# 杀掉旧的 demo 进程——按端口找，不依赖 pidfile（pnpm 会 fork 子进程，
# 只杀 pnpm 自己那个 PID 杀不干净子进程，按端口找到的才是真正监听的那个）。
# 必须限定 -sTCP:LISTEN：不加这个条件 lsof -ti 会把"连接过这个端口的"无关进程也列出来
# （实测撞见过 Chrome / Safari 的网络子进程），只有 LISTEN 状态的才是真正占着端口的服务本身。
old_pid="$(lsof -ti "tcp:${DEMO_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$old_pid" ]; then
  kill $old_pid 2>/dev/null
  for _ in $(seq 1 10); do
    lsof -ti "tcp:${DEMO_PORT}" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
  lsof -ti "tcp:${DEMO_PORT}" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null
fi

nohup pnpm demo >"$LOGFILE" 2>&1 &
disown 2>/dev/null || true

printf '%s' "$sig" > "$MARKER"
printf '{"systemMessage":"demo 已重启中（端口 %s，几秒后可测试；日志见 %s）"}\n' "$DEMO_PORT" "$LOGFILE"
exit 0
