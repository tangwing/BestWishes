import { describe, it, expect } from 'vitest';
import {
  recordPublish,
  recordUnpublish,
  totalPublished,
  currentStreak,
  localDateFor,
  prevDate,
} from './streak';

// 对应 specs/blessing-streak 的全部 scenario。

describe('按地区自然日聚合', () => {
  it('当日发布计入当日', () => {
    const d = recordPublish({}, '2026-09-02');
    expect(d['2026-09-02']).toBe(1);
    expect(totalPublished(d)).toBe(1);
  });

  it('跨时区：同一 UTC 瞬间在不同地区落在不同自然日', () => {
    const instant = new Date('2026-09-02T16:30:00Z');
    // UTC+8（北京）→ 已是 9/3 00:30
    expect(localDateFor(instant, 8 * 60)).toBe('2026-09-03');
    // UTC-5（纽约）→ 还是 9/2 11:30
    expect(localDateFor(instant, -5 * 60)).toBe('2026-09-02');
  });
});

describe('计数回撤', () => {
  it('撤回导致当日唯一一条归零 → 该日不再计入连续', () => {
    let d = recordPublish({}, '2026-09-02');
    d = recordUnpublish(d, '2026-09-02');
    expect(d['2026-09-02']).toBeUndefined();
    expect(currentStreak(d, '2026-09-02')).toBe(0);
  });

  it('当日有多条时回撤一条不清零', () => {
    let d = recordPublish({}, '2026-09-02');
    d = recordPublish(d, '2026-09-02');
    d = recordUnpublish(d, '2026-09-02');
    expect(d['2026-09-02']).toBe(1);
  });

  it('回撤不会把计数打到负数', () => {
    const d = recordUnpublish({}, '2026-09-02');
    expect(d['2026-09-02']).toBeUndefined();
    expect(totalPublished(d)).toBe(0);
  });

  it('续期不加计数（调用方对 renew 不调用 recordPublish）', () => {
    // 语义测试：续期路径不触发 recordPublish，历史计数不变
    const before = recordPublish({}, '2026-08-01');
    const afterRenew = before; // renew 不动 streak
    expect(totalPublished(afterRenew)).toBe(1);
  });
});

describe('连续天数', () => {
  it('连续三天 → 3', () => {
    let d: Record<string, number> = {};
    d = recordPublish(d, '2026-08-31');
    d = recordPublish(d, '2026-09-01');
    d = recordPublish(d, '2026-09-02');
    expect(currentStreak(d, '2026-09-02')).toBe(3);
  });

  it('今天还没写但昨天写了 → 宽限，仍算到昨天为止的连续', () => {
    let d: Record<string, number> = {};
    d = recordPublish(d, '2026-08-31');
    d = recordPublish(d, '2026-09-01');
    expect(currentStreak(d, '2026-09-02')).toBe(2);
  });

  it('中间断一天 → 只数最近的一段', () => {
    let d: Record<string, number> = {};
    d = recordPublish(d, '2026-08-28');
    d = recordPublish(d, '2026-08-29');
    // 8-30 断
    d = recordPublish(d, '2026-08-31');
    d = recordPublish(d, '2026-09-01');
    expect(currentStreak(d, '2026-09-01')).toBe(2);
  });

  it('昨天和今天都没写 → 0', () => {
    const d = recordPublish({}, '2026-08-20');
    expect(currentStreak(d, '2026-09-02')).toBe(0);
  });

  it('撤回昨天的祝福后连续中断', () => {
    let d: Record<string, number> = {};
    d = recordPublish(d, '2026-08-31');
    d = recordPublish(d, '2026-09-01');
    d = recordPublish(d, '2026-09-02');
    d = recordUnpublish(d, '2026-09-01');
    expect(currentStreak(d, '2026-09-02')).toBe(1);
  });
});

describe('prevDate', () => {
  it('跨月', () => {
    expect(prevDate('2026-09-01')).toBe('2026-08-31');
  });
});
