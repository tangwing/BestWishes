// 坚持记录（纯函数）。对应 specs/blessing-streak。
// 数据形态：本地自然日(YYYY-MM-DD) -> 当日"进入 published"的净计数。

export type StreakData = Record<string, number>;

/** 把某个瞬间换算成"用户所在地区的自然日"。地区在原型里用 UTC 偏移分钟数表示。 */
export function localDateFor(instant: Date, utcOffsetMinutes: number): string {
  const shifted = new Date(instant.getTime() + utcOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function prevDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function recordPublish(data: StreakData, localDate: string): StreakData {
  return { ...data, [localDate]: (data[localDate] ?? 0) + 1 };
}

/** 祝福因作者撤回 / 删除 / 平台下架离开 published 时回撤当日计数（链接过期不走这里）。 */
export function recordUnpublish(data: StreakData, localDate: string): StreakData {
  const nextCount = (data[localDate] ?? 0) - 1;
  const next: StreakData = {};
  for (const [date, count] of Object.entries(data)) {
    if (date === localDate) {
      if (nextCount > 0) next[date] = nextCount;
    } else {
      next[date] = count;
    }
  }
  return next;
}

export function totalPublished(data: StreakData): number {
  return Object.values(data).reduce((a, b) => a + Math.max(0, b), 0);
}

/**
 * 连续天数：从锚点日往回数、计数 > 0 且不中断的天数。
 * 锚点 = 今天（若今天有记录）；否则昨天（给"今天还没写"留一天宽限）；否则 0。
 */
export function currentStreak(data: StreakData, today: string): number {
  let anchor: string;
  if ((data[today] ?? 0) > 0) {
    anchor = today;
  } else {
    const y = prevDate(today);
    if ((data[y] ?? 0) > 0) {
      anchor = y;
    } else {
      return 0;
    }
  }

  let streak = 0;
  let cursor = anchor;
  while ((data[cursor] ?? 0) > 0) {
    streak += 1;
    cursor = prevDate(cursor);
  }
  return streak;
}
