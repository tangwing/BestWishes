// PG 仓储集成测试：把整套 application 跑在 PGlite（真实 Postgres SQL）上，
// 验证 PG 实现和内存实现满足同一组 ports 契约。走的是和 blessing-flow.test.ts 相同的核心场景。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, RuleBasedProvider } from '@bestwishes/domain';
import { createApplication, type Application } from '../../application';
import { FakeClock } from '../../application/test-harness';
import { SequentialIdGenerator, SequentialSlugGenerator } from '../ids';
import { HmacLivenessChallenge } from '../audio/liveness-challenge';
import { LocalAudioStorage } from '../audio/local-audio-storage';
import { RuleBasedAsrProvider } from '../audio/rule-based-asr';
import { RuleBasedSincerityEvaluator } from '../audio/rule-based-sincerity';
import { seedTemplates } from '../templates-seed';
import type { Repositories } from '../../ports/repositories';
import { createDb, migrateToLatest, type DbHandle } from '../db/client';
import { createPgRepositories, seedPgTemplates } from './pg-repositories';

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂。';
const CENTER = { lat: 30.2741, lng: 120.1551 };
const NEAR_A = { lat: 30.28, lng: 120.16 };
const NEAR_B = { lat: 30.27, lng: 120.15 };
const WIDE = { radiusKm: 10, ageMin: null, ageMax: null, gender: 'any' as const, tags: [] };

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
    audioStorage: new LocalAudioStorage('/tmp/bestwishes-test-audio-pg'),
    asr: new RuleBasedAsrProvider(),
    sincerity: new RuleBasedSincerityEvaluator(),
    liveness: new HmacLivenessChallenge('test-liveness-secret'),
  });
});

afterEach(async () => {
  await handle.close();
});

async function seedUser(
  nickname: string,
  opts: { lat?: number; lng?: number; consent?: boolean } = {},
): Promise<string> {
  const user = await app.auth.loginWithStub(nickname);
  if (opts.lat !== undefined && opts.lng !== undefined) {
    await app.profile.update(user.id, { lat: opts.lat, lng: opts.lng });
  }
  if (opts.consent) {
    await app.consent.record(user.id, {
      scopeDeliver: true,
      scopeFeatured: true,
      scopeSynthesis: false,
    });
  }
  return user.id;
}

describe('PG 仓储：核心流程', () => {
  it('范本种子写入并读回（共 ≥ 18）', async () => {
    const list = await app.templates.list();
    expect(list.length).toBeGreaterThanOrEqual(18);
  });

  it('群发：预览受众 → 提交 → hold 后发布 → 收件箱 + 通知 + 累计善意 +1 → 事件从子表拼回', async () => {
    const sender = await seedUser('小林', { ...CENTER, consent: true });
    const alice = await seedUser('阿离', NEAR_A);
    await seedUser('阿波', NEAR_B);

    const preview = await app.audience.preview(sender, WIDE);
    expect(preview.ok && preview.value.count).toBe(2);

    const r = await app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    clock.advance(6000);
    expect(await app.scans.publishReady()).toBe(1);

    const inbox = await app.inbox.list(alice);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.status).toBe('content');
    expect(inbox[0]?.body).toContain('温柔以待');
    expect(await app.notifications.unreadCount(alice)).toBe(1);
    expect((await app.profile.view(sender))?.kindnessCount).toBe(1);

    const b = await repos.blessings.findById(r.value.id);
    expect(b?.events.some((e) => e.to === 'published')).toBe(true);
    expect(b?.recipientIds).toHaveLength(2);
  });

  it('撤回 → 收件人看占位 → 累计善意回撤到 0', async () => {
    const sender = await seedUser('小林', { ...CENTER, consent: true });
    const alice = await seedUser('阿离', NEAR_A);
    const r = await app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    clock.advance(6000);
    await app.scans.publishReady();

    await app.blessings.withdraw(sender, r.value.id);
    expect((await app.inbox.list(alice))[0]?.status).toBe('withdrawn');
    expect((await app.profile.view(sender))?.kindnessCount).toBe(0);
  });

  it('缺协议 → 提交被拒 consent_required', async () => {
    const sender = await seedUser('无协议', CENTER);
    await seedUser('阿离', NEAR_A);
    const r = await app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('consent_required');
  });

  it('命中拉客护栏 → suspect → 进审核队列 → 人工通过 → 投递', async () => {
    const sender = await seedUser('小林', { ...CENTER, consent: true });
    const alice = await seedUser('阿离', NEAR_A);
    const r = await app.blessings.submit(sender, {
      contentType: 'text',
      body: '愿你安好，如需超度收费请私信我们，价格公道，服务周到。',
      occasion: 'remembrance',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    clock.advance(60000);
    expect(await app.scans.publishReady()).toBe(0);

    const queue = await app.moderationQueue.queue();
    expect(queue).toHaveLength(1);
    await app.moderationQueue.resolve(queue[0]?.id ?? '', 'pass', '常见用语', 'mod');
    expect((await app.inbox.list(alice))[0]?.status).toBe('content');
  });

  it('B-92：发布祈福 → 匹配到候选人并推送通知，不因外键顺序报错', async () => {
    // 内存仓储没有真实外键约束，这条路径的顺序 bug 只在真实 PG 下才会炸——
    // wish-request-service.publish() 曾经先 matchAndNotify()（写 notifications.
    // request_id 指回这条祈福）再 wishRequests.add()，PGlite 开着 FK 约束时，
    // 记录还没插入就先写引用会直接 23503 报错，整条发布请求跟着失败。
    const author = await seedUser('求祝福的人', { ...CENTER, consent: true });
    const candidate = await seedUser('可能感兴趣的人', NEAR_A);

    const r = await app.wishRequests.publish(author, {
      beneficiaryLabel: 'TA',
      situationText: '最近压力很大，希望有人能鼓励我一下。',
      tags: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe('published');

    const notifications = await app.notifications.list(candidate);
    expect(notifications.items.some((n) => n.kind === 'wish_request_matched')).toBe(true);
  });

  it('wish_requests.anonymous / last_response_excerpt 随记录读写（PG 仓储契约同内存仓储）', async () => {
    const author = await seedUser('求祝福的人', { ...CENTER, consent: true });
    const id = 'wrq_excerpt_test';
    await repos.wishRequests.add({
      id,
      authorId: author,
      beneficiaryLabel: 'TA',
      situationText: '测试处境描述',
      scriptText: null,
      tags: [],
      state: 'published',
      createdAt: clock.now().toISOString(),
      recipientCandidateIds: [],
      moderation: null,
      responseCount: 0,
      lastResponseAt: null,
      anonymous: true,
      lastResponseExcerpt: null,
    });

    let found = await repos.wishRequests.findById(id);
    expect(found?.anonymous).toBe(true);
    expect(found?.lastResponseExcerpt).toBeNull();

    if (!found) throw new Error('not found');
    await repos.wishRequests.save({ ...found, lastResponseExcerpt: '一段摘录' });
    found = await repos.wishRequests.findById(id);
    expect(found?.lastResponseExcerpt).toBe('一段摘录');
  });
});
