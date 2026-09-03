// PG 仓储集成测试：把整套 application 跑在 PGlite（真实 Postgres SQL）上，
// 验证 PG 实现和内存实现满足同一组 ports 契约。走的是和 api-flow.test.ts 相同的核心场景。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, RuleBasedProvider } from '@bestwishes/domain';
import { createApplication, type Application } from '../../application';
import { FakeClock } from '../../application/test-harness';
import { SequentialIdGenerator, SequentialSlugGenerator } from '../ids';
import { seedTemplates } from '../templates-seed';
import type { Repositories } from '../../ports/repositories';
import { createDb, migrateToLatest, type DbHandle } from '../db/client';
import { createPgRepositories, seedPgTemplates } from './pg-repositories';

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂。';

let handle: DbHandle;
let clock: FakeClock;
let repos: Repositories;
let app: Application;

beforeEach(async () => {
  handle = createDb();
  await migrateToLatest(handle.db);
  await seedPgTemplates(handle.db, seedTemplates());

  clock = new FakeClock();
  const config = { ...DEFAULT_CONFIG, holdSeconds: 5 };
  repos = createPgRepositories(handle.db, new SequentialIdGenerator());
  app = createApplication({
    repos,
    clock,
    ids: new SequentialIdGenerator(),
    slugs: new SequentialSlugGenerator(),
    moderation: new RuleBasedProvider({ config }),
    config,
  });
});

afterEach(async () => {
  await handle.close();
});

async function loginAndAgree(nickname: string): Promise<string> {
  const user = await app.auth.loginWithStub(nickname);
  await app.consent.record(user.id, {
    scopeDeliver: true,
    scopeFeatured: true,
    scopeSynthesis: false,
  });
  return user.id;
}

describe('PG 仓储：核心流程', () => {
  it('范本种子写入并读回（共 ≥ 18）', async () => {
    const list = await app.templates.list();
    expect(list.length).toBeGreaterThanOrEqual(18);
  });

  it('提交 → hold 中占位 → hold 后发布 → 访客看正文 → 坚持记录 +1 → 事件从子表拼回', async () => {
    const userId = await loginAndAgree('小林');

    const submitted = await app.blessings.submit(userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明', fromCity: '杭州' },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const { id, slug } = submitted.value;

    expect((await app.blessings.getPublicPage(slug)).type).toBe('preparing');

    clock.advance(6000);
    await app.scans.publishReady();

    const page = await app.blessings.getPublicPage(slug);
    expect(page.type).toBe('content');
    expect(page.content?.body).toContain('温柔以待');
    expect(page.content?.fromLine).toContain('杭州');

    expect((await app.streak.view(userId))?.total).toBe(1);

    const stored = await repos.blessings.findById(id);
    expect(stored?.events.length).toBeGreaterThanOrEqual(2);
    expect(stored?.events.at(-1)?.to).toBe('published');
  });

  it('撤回 → 访客看占位 → 坚持记录回撤到 0', async () => {
    const userId = await loginAndAgree('小林');
    const submitted = await app.blessings.submit(userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    if (!submitted.ok) return;
    clock.advance(6000);
    await app.scans.publishReady();

    expect((await app.blessings.withdraw(userId, submitted.value.id)).ok).toBe(true);
    expect((await app.blessings.getPublicPage(submitted.value.slug)).type).toBe('withdrawn');
    expect((await app.streak.view(userId))?.total).toBe(0);
  });

  it('缺协议 → 提交被拒 consent_required', async () => {
    const user = await app.auth.loginWithStub('无协议');
    const r = await app.blessings.submit(user.id, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('consent_required');
  });

  it('命中护栏词 → suspect → 进审核队列 → 人工通过 → 送达', async () => {
    const userId = await loginAndAgree('小林');
    const r = await app.blessings.submit(userId, {
      body: '愿你平安，如需超度收费请私信我们，价格公道，服务周到。',
      occasion: 'remembrance',
      personalization: { toName: '故人' },
    });
    if (!r.ok) return;
    clock.advance(60000);
    await app.scans.publishReady();
    expect((await app.blessings.getPublicPage(r.value.slug)).type).toBe('preparing');

    const queue = await app.moderationQueue.queue();
    expect(queue.some((q) => q.origin === 'auto_suspect')).toBe(true);
    const first = queue[0];
    if (!first) throw new Error('队列为空');

    await app.moderationQueue.resolve(first.id, 'pass', '常见悼念用语', userId);
    expect((await app.blessings.getPublicPage(r.value.slug)).type).toBe('content');
  });
});
