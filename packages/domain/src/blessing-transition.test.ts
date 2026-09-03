import { describe, it, expect } from 'vitest';
import { applyBlessingTransition } from './blessing-transition';
import type { Blessing } from './types';

function base(over: Partial<Blessing> = {}): Blessing {
  return {
    id: 'b1',
    authorId: 'u1',
    contentType: 'text',
    body: '愿你平安顺遂',
    media: null,
    occasion: 'daily',
    scope: 'broadcast',
    audience: { radiusKm: 5, ageMin: null, ageMax: null, gender: 'any', tags: [] },
    replyToUserId: null,
    recipientIds: ['u2'],
    state: 'verifying',
    slug: 's1',
    createdAt: '2026-09-02T00:00:00.000Z',
    publishedAt: null,
    deliveredAt: null,
    expiresAt: null,
    moderation: null,
    renewCount: 0,
    countedInStreak: false,
    events: [],
    ...over,
  };
}

const ctx = { at: '2026-09-02T01:00:00.000Z', linkTtlDays: 120 };
const sys = { kind: 'system' } as const;

describe('applyBlessingTransition', () => {
  it('首次发布：置 publishedAt / expiresAt，streakDelta +1，追加事件', () => {
    const r = applyBlessingTransition(base(), 'auto_pass', sys, undefined, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blessing.state).toBe('published');
    expect(r.blessing.publishedAt).toBe(ctx.at);
    expect(r.blessing.expiresAt).toBe('2026-12-31T01:00:00.000Z');
    expect(r.blessing.countedInStreak).toBe(true);
    expect(r.streakDelta).toBe(1);
    expect(r.blessing.events).toHaveLength(1);
  });

  it('非法转移被拒', () => {
    const r = applyBlessingTransition(base({ state: 'deleted' }), 'auto_pass', sys, undefined, ctx);
    expect(r.ok).toBe(false);
  });

  it('作者撤回已发布 → streakDelta -1，countedInStreak 归 false', () => {
    const published = base({
      state: 'published',
      countedInStreak: true,
      publishedAt: '2026-09-02T00:30:00Z',
    });
    const r = applyBlessingTransition(
      published,
      'withdraw',
      { kind: 'author', userId: 'u1' },
      undefined,
      ctx,
    );
    expect(r.ok && r.streakDelta).toBe(-1);
    expect(r.ok && r.blessing.countedInStreak).toBe(false);
  });

  it('链接过期 → 不动坚持记录', () => {
    const published = base({ state: 'published', countedInStreak: true });
    const r = applyBlessingTransition(published, 'expire', sys, undefined, ctx);
    expect(r.ok && r.streakDelta).toBe(0);
    expect(r.ok && r.blessing.countedInStreak).toBe(true);
  });

  it('续期：顺延 expiresAt、renewCount +1、streakDelta 0', () => {
    const expired = base({ state: 'expired', countedInStreak: true, renewCount: 0 });
    const r = applyBlessingTransition(
      expired,
      'renew',
      { kind: 'author', userId: 'u1' },
      undefined,
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blessing.state).toBe('published');
    expect(r.blessing.renewCount).toBe(1);
    expect(r.streakDelta).toBe(0);
  });

  it('过期后再删除仍回撤（countedInStreak 还是 true）', () => {
    const expired = base({ state: 'expired', countedInStreak: true });
    const r = applyBlessingTransition(
      expired,
      'delete',
      { kind: 'author', userId: 'u1' },
      undefined,
      ctx,
    );
    expect(r.ok && r.streakDelta).toBe(-1);
  });
});
