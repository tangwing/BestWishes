import { describe, it, expect, beforeEach } from 'vitest';
import type { Repositories } from '../../ports/repositories';
import type { BlessingRecord } from '../../ports/records';
import { SequentialIdGenerator } from '../ids';
import { createInMemoryRepositories } from './in-memory-repositories';

let repos: Repositories;
beforeEach(() => {
  repos = createInMemoryRepositories({ ids: new SequentialIdGenerator() });
});

function blessing(over: Partial<BlessingRecord> = {}): BlessingRecord {
  return {
    id: 'bls_x',
    authorId: 'usr_1',
    body: '愿你平安顺遂，一切都好。',
    personalization: { toName: '阿明' },
    occasion: 'daily',
    state: 'verifying',
    slug: 'slug1',
    createdAt: '2026-09-02T00:00:00.000Z',
    publishedAt: null,
    expiresAt: null,
    moderation: null,
    renewCount: 0,
    countedInStreak: false,
    events: [],
    ...over,
  };
}

describe('用户仓储：openid 幂等', () => {
  it('同一 openid 多次 findOrCreate 只建一个账户', async () => {
    const make = () => ({
      wxOpenid: 'openid-A',
      wxUnionid: null,
      nickname: '阿念',
      avatarUrl: null,
      source: 'wx',
    });
    const a = await repos.users.findOrCreateByOpenid('openid-A', make);
    const b = await repos.users.findOrCreateByOpenid('openid-A', make);
    expect(a.id).toBe(b.id);
  });
});

describe('祝福仓储', () => {
  it('slug 唯一', async () => {
    await repos.blessings.add(blessing({ id: 'bls_1', slug: 's' }));
    await expect(repos.blessings.add(blessing({ id: 'bls_2', slug: 's' }))).rejects.toThrow();
  });

  it('按 slug 找回', async () => {
    await repos.blessings.add(blessing({ id: 'bls_1', slug: 'abc' }));
    const found = await repos.blessings.findBySlug('abc');
    expect(found?.id).toBe('bls_1');
  });

  it('返回的是副本，改它不影响仓储', async () => {
    await repos.blessings.add(blessing({ id: 'bls_1' }));
    const a = await repos.blessings.findById('bls_1');
    a!.body = '被篡改';
    const b = await repos.blessings.findById('bls_1');
    expect(b!.body).not.toBe('被篡改');
  });

  it('按状态列出', async () => {
    await repos.blessings.add(blessing({ id: 'bls_1', slug: 's1', state: 'published' }));
    await repos.blessings.add(blessing({ id: 'bls_2', slug: 's2', state: 'verifying' }));
    const published = await repos.blessings.listByState('published');
    expect(published.map((b) => b.id)).toEqual(['bls_1']);
  });
});

describe('复核工单仓储：优先级排序', () => {
  it('listOpen 按优先级降序', async () => {
    const base = {
      blessingId: 'bls_1',
      category: 'other' as const,
      state: 'open' as const,
      note: null,
      assignee: null,
      resolutionReason: null,
      reporterFingerprint: null,
      count: 1,
      resolvedAt: null,
      timeline: [],
    };
    await repos.reports.add({
      ...base,
      id: 'r_low',
      origin: 'auto_suspect',
      priority: 30,
      createdAt: '2026-09-02T00:00:00Z',
    });
    await repos.reports.add({
      ...base,
      id: 'r_high',
      origin: 'report',
      priority: 90,
      createdAt: '2026-09-02T00:01:00Z',
    });
    const open = await repos.reports.listOpen();
    expect(open.map((r) => r.id)).toEqual(['r_high', 'r_low']);
  });
});
