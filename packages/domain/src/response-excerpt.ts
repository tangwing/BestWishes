// 祈福广场列表项"最新一条回应摘录"的截断规则（纯函数）。
// 见 redesign-kindness-entry design D3：摘录随 responseCount / lastResponseAt 同一写入路径维护。

export const RESPONSE_EXCERPT_MAX_CHARS = 60;

/**
 * 取回应正文或音频转写的前 N 字作为摘录。传 null（音频无转写）、空串或纯空白都返回 null——
 * 不能因为没有转写就让这条回应在列表上"消失"，responseCount 仍照常计数，只是摘录位置留空。
 */
export function truncateResponseExcerpt(
  text: string | null,
  maxChars: number = RESPONSE_EXCERPT_MAX_CHARS,
): string | null {
  if (text === null) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const chars = Array.from(trimmed);
  return chars.length <= maxChars ? trimmed : `${chars.slice(0, maxChars).join('')}…`;
}
