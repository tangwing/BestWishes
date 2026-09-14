// 登录 / 协议同意之后"回到原处"的小工具。只接受站内相对路径，挡掉 `//evil.com` 这类开放重定向。
// 见 kindness-entry「登录发生在提交那一刻」：未登录用户写完内容点提交时，MUST 回到原来的位置。

export function safeReturnTo(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}

export function loginUrl(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function agreementUrl(returnTo: string): string {
  return `/agreement?returnTo=${encodeURIComponent(returnTo)}`;
}
