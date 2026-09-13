/** 消息类列表统一的时间戳展示格式，如"9/13 14:05"。 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
