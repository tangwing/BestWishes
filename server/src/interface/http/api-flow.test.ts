import { describe, it, expect } from 'vitest';
import { seedTemplates } from '../../infrastructure/templates-seed';
import { makeServer } from './test-server';

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂。';

const CENTER = { lat: 30.2741, lng: 120.1551 };
const NEAR_A = { lat: 30.28, lng: 120.16 };
const NEAR_B = { lat: 30.27, lng: 120.15 };

const WIDE = { radiusKm: 10, ageMin: null, ageMax: null, gender: 'any', tags: [] };

type Server = Awaited<ReturnType<typeof makeServer>>['server'];

async function login(server: Server, nickname: string): Promise<{ cookie: string }> {
  const res = await server.inject({
    method: 'POST',
    url: '/api/auth/stub-login',
    payload: { nickname },
  });
  const c = res.cookies.find((x) => x.name === 'bw_uid');
  if (!c) throw new Error('no session cookie');
  return { cookie: `bw_uid=${c.value}` };
}

async function setProfile(
  server: Server,
  auth: { cookie: string },
  patch: Record<string, unknown>,
): Promise<void> {
  await server.inject({ method: 'PUT', url: '/api/profile/me', headers: auth, payload: patch });
}

async function agree(server: Server, auth: { cookie: string }): Promise<void> {
  await server.inject({
    method: 'POST',
    url: '/api/consents',
    headers: auth,
    payload: { scopeDeliver: true, scopeFeatured: true, scopeSynthesis: false },
  });
}

describe('HTTP 端到端：群发到陌生人', () => {
  it('登录 → 设位置 → 协议 → 预览受众 → 提交 → hold 后发布 → 收件人收件箱 + 通知', async () => {
    const ctx = await makeServer({ templates: seedTemplates() });
    const sender = await login(ctx.server, '发送者');
    await setProfile(ctx.server, sender, CENTER);
    await agree(ctx.server, sender);

    const alice = await login(ctx.server, '阿离');
    await setProfile(ctx.server, alice, NEAR_A);
    const bob = await login(ctx.server, '阿波');
    await setProfile(ctx.server, bob, NEAR_B);

    const preview = await ctx.server.inject({
      method: 'POST',
      url: '/api/audience/preview',
      headers: sender,
      payload: WIDE,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json<{ count: number; canSend: boolean }>().count).toBe(2);

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: sender,
      payload: {
        contentType: 'text',
        body: GOOD_BODY,
        occasion: 'daily',
        scope: 'broadcast',
        audience: WIDE,
      },
    });
    expect(submit.statusCode).toBe(200);
    expect(submit.json<{ recipientCount: number }>().recipientCount).toBe(2);

    // hold 期间收件箱为空
    const early = await ctx.server.inject({ method: 'GET', url: '/api/inbox', headers: alice });
    expect(early.json<unknown[]>()).toHaveLength(0);

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const inbox = await ctx.server.inject({ method: 'GET', url: '/api/inbox', headers: alice });
    const items = inbox.json<{ status: string; body: string; from: { nickname: string } }[]>();
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('content');
    expect(items[0]?.body).toContain('温柔以待');
    expect(items[0]?.from.nickname).toBe('发送者');

    const notif = await ctx.server.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: bob,
    });
    expect(notif.json<{ unread: number }>().unread).toBe(1);

    await ctx.server.close();
  });

  it('没设位置 → 提交 422 location_required', async () => {
    const ctx = await makeServer();
    const sender = await login(ctx.server, '没位置');
    await agree(ctx.server, sender);
    const res = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: sender,
      payload: {
        contentType: 'text',
        body: GOOD_BODY,
        occasion: 'daily',
        scope: 'broadcast',
        audience: WIDE,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: string }>().error).toBe('location_required');
    await ctx.server.close();
  });

  it('缺协议 → 提交 403 consent_required', async () => {
    const ctx = await makeServer();
    const sender = await login(ctx.server, '没协议');
    await setProfile(ctx.server, sender, CENTER);
    await login(ctx.server, '阿离').then((a) => setProfile(ctx.server, a, NEAR_A));
    const res = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: sender,
      payload: {
        contentType: 'text',
        body: GOOD_BODY,
        occasion: 'daily',
        scope: 'broadcast',
        audience: WIDE,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: string }>().error).toBe('consent_required');
    await ctx.server.close();
  });

  it('协议接口回报是否已同意：同意前 false，同意后 true', async () => {
    const ctx = await makeServer();
    const auth = await login(ctx.server, '待同意');
    const before = await ctx.server.inject({
      method: 'GET',
      url: '/api/agreement/current',
      headers: auth,
    });
    expect(before.json<{ alreadyConsented: boolean }>().alreadyConsented).toBe(false);
    await agree(ctx.server, auth);
    const after = await ctx.server.inject({
      method: 'GET',
      url: '/api/agreement/current',
      headers: auth,
    });
    expect(after.json<{ alreadyConsented: boolean }>().alreadyConsented).toBe(true);
    await ctx.server.close();
  });

  it('范本接口返回参考范本（每类≥3）', async () => {
    const ctx = await makeServer({ templates: seedTemplates() });
    const res = await ctx.server.inject({ method: 'GET', url: '/api/templates' });
    expect(res.json<unknown[]>().length).toBeGreaterThanOrEqual(18);
    await ctx.server.close();
  });

  it('命中拉客护栏 → suspect → 进队列 → 人工通过 → 投递到收件箱', async () => {
    const ctx = await makeServer({ templates: seedTemplates() });
    const sender = await login(ctx.server, '发送者');
    await setProfile(ctx.server, sender, CENTER);
    await agree(ctx.server, sender);
    const alice = await login(ctx.server, '阿离');
    await setProfile(ctx.server, alice, NEAR_A);

    await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: sender,
      payload: {
        contentType: 'text',
        body: '愿你安好，如需超度收费请私信我们，价格公道，服务周到。',
        occasion: 'remembrance',
        scope: 'broadcast',
        audience: WIDE,
      },
    });
    ctx.clock.advance(60000);
    await ctx.app.scans.publishReady();
    expect(
      (await ctx.server.inject({ method: 'GET', url: '/api/inbox', headers: alice })).json<
        unknown[]
      >(),
    ).toHaveLength(0);

    const queue = (
      await ctx.server.inject({ method: 'GET', url: '/api/moderation/queue', headers: sender })
    ).json<{ id: string; origin: string }[]>();
    expect(queue.some((q) => q.origin === 'auto_suspect')).toBe(true);

    await ctx.server.inject({
      method: 'POST',
      url: `/api/moderation/${queue[0]?.id ?? ''}/resolve`,
      headers: sender,
      payload: { action: 'pass', reason: '常见悼念用语' },
    });
    const inbox = (
      await ctx.server.inject({ method: 'GET', url: '/api/inbox', headers: alice })
    ).json<{ status: string }[]>();
    expect(inbox[0]?.status).toBe('content');
    await ctx.server.close();
  });

  it('访客举报高危 → 公开页即时占位 + 进队列', async () => {
    const ctx = await makeServer({ templates: seedTemplates() });
    const sender = await login(ctx.server, '发送者');
    await setProfile(ctx.server, sender, CENTER);
    await agree(ctx.server, sender);
    await login(ctx.server, '阿离').then((a) => setProfile(ctx.server, a, NEAR_A));

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: sender,
      payload: {
        contentType: 'text',
        body: GOOD_BODY,
        occasion: 'daily',
        scope: 'broadcast',
        audience: WIDE,
      },
    });
    const { slug } = submit.json<{ slug: string }>();
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    await ctx.server.inject({
      method: 'POST',
      url: `/api/p/${slug}/report`,
      payload: { category: 'illegal', note: '疑似违法' },
    });
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('taken_down');

    const queue = (
      await ctx.server.inject({ method: 'GET', url: '/api/moderation/queue', headers: sender })
    ).json<{ priority: number }[]>();
    expect(queue[0]?.priority).toBe(90);
    await ctx.server.close();
  });
});
