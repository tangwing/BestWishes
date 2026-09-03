import { describe, it, expect } from 'vitest';
import { ageInYears, haversineKm, matchesAudience, resolveAudience } from './audience';
import type { AudienceCandidate, AudienceFilter } from './types';

// 杭州市中心附近的几个点
const HZ = { lat: 30.2741, lng: 120.1551 };
const NEAR = { lat: 30.28, lng: 120.16 }; // ~1km
const FAR = { lat: 30.5, lng: 120.5 }; // ~40km

const NOW = new Date('2026-09-04T00:00:00.000Z');

function candidate(over: Partial<AudienceCandidate> = {}): AudienceCandidate {
  return {
    userId: 'u_x',
    nickname: '某人',
    city: '杭州',
    point: NEAR,
    gender: 'female',
    birthYear: 1996,
    tags: ['晚睡'],
    ...over,
  };
}

const anyFilter: AudienceFilter = {
  radiusKm: 5,
  ageMin: null,
  ageMax: null,
  gender: 'any',
  tags: [],
};

describe('haversineKm', () => {
  it('同一点距离为 0', () => {
    expect(haversineKm(HZ, HZ)).toBeCloseTo(0, 5);
  });
  it('约 1 公里的两点', () => {
    const d = haversineKm(HZ, NEAR);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(1.5);
  });
});

describe('ageInYears', () => {
  it('按年份差', () => {
    expect(ageInYears(1996, NOW)).toBe(30);
  });
});

describe('matchesAudience', () => {
  it('半径内 + 无其它限制 → 命中', () => {
    expect(matchesAudience(candidate(), anyFilter, HZ, NOW)).toBe(true);
  });
  it('超出半径 → 不命中', () => {
    expect(matchesAudience(candidate({ point: FAR }), anyFilter, HZ, NOW)).toBe(false);
  });
  it('没有位置 → 不命中', () => {
    expect(matchesAudience(candidate({ point: null }), anyFilter, HZ, NOW)).toBe(false);
  });
  it('性别不符 → 不命中', () => {
    expect(
      matchesAudience(candidate({ gender: 'male' }), { ...anyFilter, gender: 'female' }, HZ, NOW),
    ).toBe(false);
  });
  it('年龄区间：不在区间 → 不命中；缺出生年 + 有年龄条件 → 不命中', () => {
    expect(
      matchesAudience(
        candidate({ birthYear: 1980 }),
        { ...anyFilter, ageMin: 20, ageMax: 30 },
        HZ,
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesAudience(candidate({ birthYear: null }), { ...anyFilter, ageMin: 20 }, HZ, NOW),
    ).toBe(false);
  });
  it('标签：命中任一即可；一个都不沾 → 不命中', () => {
    expect(
      matchesAudience(
        candidate({ tags: ['考研', '早起'] }),
        { ...anyFilter, tags: ['早起', '带娃'] },
        HZ,
        NOW,
      ),
    ).toBe(true);
    expect(
      matchesAudience(candidate({ tags: ['考研'] }), { ...anyFilter, tags: ['带娃'] }, HZ, NOW),
    ).toBe(false);
  });
});

describe('resolveAudience', () => {
  it('排除发送者自己，按距离升序', () => {
    const candidates: AudienceCandidate[] = [
      candidate({ userId: 'me', point: NEAR }),
      candidate({ userId: 'a', point: FAR }),
      candidate({ userId: 'b', point: NEAR }),
    ];
    const matches = resolveAudience(candidates, { ...anyFilter, radiusKm: 100 }, HZ, NOW, 'me');
    expect(matches.map((m) => m.candidate.userId)).toEqual(['b', 'a']);
    expect(matches[0]?.distanceKm).toBeLessThan(matches[1]?.distanceKm ?? Infinity);
  });
});
