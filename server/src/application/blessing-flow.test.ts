import { describe, it, expect, beforeEach } from 'vitest';
import { makeApp } from './test-harness';

type App = ReturnType<typeof makeApp>;

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺。';

async function setup(): Promise<App & { userId: string }> {
  const ctx = makeApp();
  const user = await ctx.app.auth.loginWithStub('小林');
  await ctx.app.consent.record(user.id, {
    scopeDeliver: true,
    scopeFeatured: true,
    scopeSynthesis: false,
  });
  return { ...ctx, userId: user.id };
}

describe('发布即校验、延迟送达', () => {
  let ctx: App & { userId: string };
  beforeEach(async () => {
    ctx = await setup();
  });

  it('提交后 verifying，访客看到「准备中」', async () => {
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.type).toBe('preparing');
    expect(page.content).toBeUndefined();
  });

  it('hold 到点、扫描后发布，访客看到正文 + 来源，坚持记录 +1', async () => {
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明', fromName: '小林', fromCity: '杭州' },
    });
    if (!r.ok) throw new Error('submit failed');

    ctx.clock.advance(6000);
    const n = await ctx.app.scans.publishReady();
    expect(n).toBe(1);

    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.type).toBe('content');
    expect(page.content?.body).toContain('温柔以待');
    expect(page.content?.fromLine).toBe('来自 杭州 的 小林');

    const streak = await ctx.app.streak.view(ctx.userId);
    expect(streak?.total).toBe(1);
  });

  it('落款 / 城市默认取个人空间', async () => {
    await ctx.app.profile.update(ctx.userId, { senderName: '远方的小林', regionCity: '苏州' });
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.content?.fromLine).toBe('来自 苏州 的 远方的小林');
  });

  it('撤回后访客看到「已被收回」，坚持记录回撤', async () => {
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    expect((await ctx.app.streak.view(ctx.userId))?.total).toBe(1);

    await ctx.app.blessings.withdraw(ctx.userId, r.value.id);
    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.type).toBe('withdrawn');
    expect((await ctx.app.streak.view(ctx.userId))?.total).toBe(0);
  });

  it('校验期可取消', async () => {
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    if (!r.ok) throw new Error('submit failed');
    const cancel = await ctx.app.blessings.withdraw(ctx.userId, r.value.id);
    expect(cancel.ok && cancel.value.state).toBe('withdrawn');
    ctx.clock.advance(60000);
    expect(await ctx.app.scans.publishReady()).toBe(0);
  });
});

describe('审核', () => {
  it('命中护栏词 → suspect，进队列，不发布', async () => {
    const ctx = await setup();
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: '愿你平安，如需超度收费请私信我们，价格公道。',
      occasion: 'remembrance',
      personalization: { toName: '故人' },
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(60000);
    expect(await ctx.app.scans.publishReady()).toBe(0);
    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.type).toBe('preparing');
  });

  it('命中违禁词 → rejected，访客看到中性占位', async () => {
    const ctx = await setup();
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: '祝你好运，记得参与刷单返利，轻松赚钱不是梦。',
      occasion: 'daily',
      personalization: { toName: '朋友' },
    });
    if (!r.ok) throw new Error('submit failed');
    const page = await ctx.app.blessings.getPublicPage(r.value.slug);
    expect(page.type).toBe('taken_down');
  });
});

describe('校验', () => {
  it('没同意协议不能提交', async () => {
    const ctx = makeApp();
    const user = await ctx.app.auth.loginWithStub('无协议');
    const r = await ctx.app.blessings.submit(user.id, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('consent_required');
  });

  it('正文太短被拒', async () => {
    const ctx = await setup();
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: '祝好',
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    expect(r.ok).toBe(false);
  });

  it('缺「给谁」被拒', async () => {
    const ctx = await setup();
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '  ' },
    });
    expect(r.ok).toBe(false);
  });
});

describe('链接过期与续期', () => {
  it('到期 → expired 占位；续期 → 恢复可见、不重新审核、不加计数', async () => {
    const ctx = await setup();
    const r = await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'birthday',
      personalization: { toName: '阿明' },
    });
    if (!r.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    ctx.clock.advance(121 * 86_400_000);
    expect(await ctx.app.scans.expire()).toBe(1);
    expect((await ctx.app.blessings.getPublicPage(r.value.slug)).type).toBe('expired');
    // 过期不回撤坚持记录
    expect((await ctx.app.streak.view(ctx.userId))?.total).toBe(1);

    await ctx.app.blessings.renew(ctx.userId, r.value.id);
    expect((await ctx.app.blessings.getPublicPage(r.value.slug)).type).toBe('content');
    expect((await ctx.app.streak.view(ctx.userId))?.total).toBe(1);
  });
});

describe('收发记录', () => {
  it('发件箱列出自己的祝福；收件箱为空状态', async () => {
    const ctx = await setup();
    await ctx.app.blessings.submit(ctx.userId, {
      body: GOOD_BODY,
      occasion: 'daily',
      personalization: { toName: '阿明' },
    });
    const out = await ctx.app.blessings.outbox(ctx.userId);
    expect(out).toHaveLength(1);
    const inb = await ctx.app.blessings.inbox(ctx.userId);
    expect(inb.items).toHaveLength(0);
    expect(inb.note).toContain('链接');
  });
});
