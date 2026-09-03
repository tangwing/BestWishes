import { describe, it, expect, beforeEach } from 'vitest';
import { makeApp, seedUser } from './test-harness';
import type { AudienceFilterDto } from '@bestwishes/shared';

type App = ReturnType<typeof makeApp>;

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺。';

// 杭州附近几个点
const CENTER = { lat: 30.2741, lng: 120.1551 };
const NEAR_A = { lat: 30.28, lng: 120.16 }; // ~1km
const NEAR_B = { lat: 30.27, lng: 120.15 }; // ~1km
const FAR = { lat: 31.2304, lng: 121.4737 }; // 上海 ~170km

const WIDE: AudienceFilterDto = {
  radiusKm: 10,
  ageMin: null,
  ageMax: null,
  gender: 'any',
  tags: [],
};

describe('群发到陌生人 + 收件箱 + 通知', () => {
  let ctx: App;
  let sender: string;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    ctx = makeApp();
    sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    alice = await seedUser(ctx, {
      nickname: '阿离',
      lat: NEAR_A.lat,
      lng: NEAR_A.lng,
      gender: 'female',
      birthYear: 1996,
      tags: ['晚睡'],
    });
    bob = await seedUser(ctx, {
      nickname: '阿波',
      lat: NEAR_B.lat,
      lng: NEAR_B.lng,
      gender: 'male',
      birthYear: 1988,
    });
    await seedUser(ctx, { nickname: '远方', lat: FAR.lat, lng: FAR.lng });
  });

  it('预览命中范围内的人，不含自己和范围外的人', async () => {
    const r = await ctx.app.audience.preview(sender, WIDE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.count).toBe(2);
    expect(r.value.canSend).toBe(true);
    expect(r.value.sample.map((x) => x.nickname).sort()).toEqual(['阿波', '阿离']);
  });

  it('提交 → verifying → hold 后发布 → 两人收件箱各一条 + 未读通知；回响 +1', async () => {
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.recipientCount).toBe(2);

    // hold 期间还没投递
    expect(await ctx.app.inbox.list(alice)).toHaveLength(0);

    ctx.clock.advance(6000);
    expect(await ctx.app.scans.publishReady()).toBe(1);

    const aliceInbox = await ctx.app.inbox.list(alice);
    expect(aliceInbox).toHaveLength(1);
    expect(aliceInbox[0]?.status).toBe('content');
    expect(aliceInbox[0]?.body).toContain('温柔以待');
    expect(aliceInbox[0]?.from.nickname).toBe('发送者');
    expect(aliceInbox[0]?.from.distanceKm).not.toBeNull();

    expect(await ctx.app.notifications.unreadCount(bob)).toBe(1);
    const notif = await ctx.app.notifications.list(bob);
    expect(notif.items[0]?.from.nickname).toBe('发送者');

    expect((await ctx.app.streak.view(sender))?.total).toBe(1);
  });

  it('范围内没有人 → audience_empty', async () => {
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: { ...WIDE, radiusKm: 0.2 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('audience_empty');
  });

  it('命中人数超过上限 → audience_too_large', async () => {
    const small = makeApp({ maxAudienceSize: 1 });
    const s = await seedUser(small, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    await seedUser(small, { nickname: 'x', lat: NEAR_A.lat, lng: NEAR_A.lng });
    await seedUser(small, { nickname: 'y', lat: NEAR_B.lat, lng: NEAR_B.lng });
    const r = await small.app.blessings.submit(s, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('audience_too_large');
  });

  it('发送者没设位置 → location_required', async () => {
    const noLoc = await seedUser(ctx, { nickname: '没位置', consent: true });
    const r = await ctx.app.blessings.submit(noLoc, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('location_required');
  });

  it('没同意协议 → consent_required', async () => {
    const noConsent = await seedUser(ctx, { nickname: '没协议', lat: CENTER.lat, lng: CENTER.lng });
    const r = await ctx.app.blessings.submit(noConsent, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('consent_required');
  });

  it('正文太短被拒', async () => {
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: '祝好',
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
  });

  it('语音 / 视频形态 P1 暂不支持', async () => {
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'audio',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    expect(r.ok).toBe(false);
  });
});

describe('审核', () => {
  it('命中拉客护栏 → suspect，停在校验中，不投递；人工通过后投递', async () => {
    const ctx = makeApp();
    const sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const alice = await seedUser(ctx, { nickname: '阿离', lat: NEAR_A.lat, lng: NEAR_A.lng });

    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: '愿你安好，如需超度收费请私信，价格公道，服务周到。',
      occasion: 'remembrance',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(60000);
    expect(await ctx.app.scans.publishReady()).toBe(0);
    expect(await ctx.app.inbox.list(alice)).toHaveLength(0);

    const queue = await ctx.app.moderationQueue.queue();
    expect(queue).toHaveLength(1);
    await ctx.app.moderationQueue.resolve(queue[0]?.id ?? '', 'pass', '常见用语', 'mod');
    expect((await ctx.app.inbox.list(alice))[0]?.status).toBe('content');
  });

  it('命中违禁词 → rejected，不投递', async () => {
    const ctx = makeApp();
    const sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const alice = await seedUser(ctx, { nickname: '阿离', lat: NEAR_A.lat, lng: NEAR_A.lng });
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: '祝你好运，记得参与刷单返利，轻松赚钱不是梦。',
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    expect(r.value.state).toBe('rejected');
    ctx.clock.advance(60000);
    await ctx.app.scans.publishReady();
    expect(await ctx.app.inbox.list(alice)).toHaveLength(0);
  });
});

describe('回复（不能对话，只能回一段祝福）', () => {
  it('收件人回一段祝福 → 原发送者收件箱里出现', async () => {
    const ctx = makeApp();
    const sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const alice = await seedUser(ctx, {
      nickname: '阿离',
      consent: true,
      lat: NEAR_A.lat,
      lng: NEAR_A.lng,
    });

    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const reply = await ctx.app.blessings.submit(alice, {
      contentType: 'text',
      body: '谢谢你的祝福，也愿你被温柔以待，一切都好。',
      occasion: 'daily',
      scope: 'reply',
      replyToUserId: sender,
    });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    expect(reply.value.recipientCount).toBe(1);
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const senderInbox = await ctx.app.inbox.list(sender);
    expect(senderInbox).toHaveLength(1);
    expect(senderInbox[0]?.from.nickname).toBe('阿离');
  });

  it('不能回复自己', async () => {
    const ctx = makeApp();
    const me = await seedUser(ctx, {
      nickname: '我',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const r = await ctx.app.blessings.submit(me, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'reply',
      replyToUserId: me,
    });
    expect(r.ok).toBe(false);
  });
});

describe('作者管理 + 回响回撤', () => {
  it('撤回后收件人看到占位，回响回撤', async () => {
    const ctx = makeApp();
    const sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const alice = await seedUser(ctx, { nickname: '阿离', lat: NEAR_A.lat, lng: NEAR_A.lng });
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'daily',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    expect((await ctx.app.streak.view(sender))?.total).toBe(1);

    await ctx.app.blessings.withdraw(sender, r.value.id);
    const inbox = await ctx.app.inbox.list(alice);
    expect(inbox[0]?.status).toBe('withdrawn');
    expect(inbox[0]?.body).toBeNull();
    expect((await ctx.app.streak.view(sender))?.total).toBe(0);
  });

  it('链接到期 → 续期恢复可见，不重复计数', async () => {
    const ctx = makeApp();
    const sender = await seedUser(ctx, {
      nickname: '发送者',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    await seedUser(ctx, { nickname: '阿离', lat: NEAR_A.lat, lng: NEAR_A.lng });
    const r = await ctx.app.blessings.submit(sender, {
      contentType: 'text',
      body: GOOD_BODY,
      occasion: 'birthday',
      scope: 'broadcast',
      audience: WIDE,
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    ctx.clock.advance(121 * 86_400_000);
    expect(await ctx.app.scans.expire()).toBe(1);
    expect((await ctx.app.blessings.getPublicPage(r.value.slug)).type).toBe('expired');
    expect((await ctx.app.streak.view(sender))?.total).toBe(1);

    await ctx.app.blessings.renew(sender, r.value.id);
    expect((await ctx.app.blessings.getPublicPage(r.value.slug)).type).toBe('content');
    expect((await ctx.app.streak.view(sender))?.total).toBe(1);
  });
});
