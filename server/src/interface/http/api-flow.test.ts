import { describe, it, expect } from 'vitest';
import { seedTemplates } from '../../infrastructure/templates-seed';
import { makeServer } from './test-server';

const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂。';

async function loggedInServer() {
  const ctx = await makeServer({ templates: seedTemplates() });
  const login = await ctx.server.inject({
    method: 'POST',
    url: '/api/auth/stub-login',
    payload: { nickname: '小林' },
  });
  const cookie = login.cookies.find((c) => c.name === 'bw_uid');
  if (!cookie) throw new Error('no session cookie');
  const auth = { cookie: `bw_uid=${cookie.value}` };
  await ctx.server.inject({
    method: 'POST',
    url: '/api/consents',
    headers: auth,
    payload: { scopeDeliver: true, scopeFeatured: true, scopeSynthesis: false },
  });
  return { ...ctx, auth };
}

describe('HTTP 端到端：核心流程', () => {
  it('登录 → 协议 → 提交 → 校验中占位 → hold 后发布 → 访客看正文', async () => {
    const ctx = await loggedInServer();

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: ctx.auth,
      payload: {
        body: GOOD_BODY,
        occasion: 'daily',
        personalization: { toName: '阿明', fromCity: '杭州' },
      },
    });
    expect(submit.statusCode).toBe(200);
    const { slug } = submit.json<{ slug: string }>();

    const preparing = await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` });
    expect(preparing.json<{ type: string }>().type).toBe('preparing');

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const page = await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` });
    const body = page.json<{ type: string; content?: { body: string; fromLine: string } }>();
    expect(body.type).toBe('content');
    expect(body.content?.body).toContain('温柔以待');
    expect(body.content?.fromLine).toContain('杭州');

    const streak = await ctx.server.inject({
      method: 'GET',
      url: '/api/streak/me',
      headers: ctx.auth,
    });
    expect(streak.json<{ total: number }>().total).toBe(1);

    await ctx.server.close();
  });

  it('撤回 → 访客看到占位 → 坚持记录回撤', async () => {
    const ctx = await loggedInServer();
    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: ctx.auth,
      payload: { body: GOOD_BODY, occasion: 'daily', personalization: { toName: '阿明' } },
    });
    const { id, slug } = submit.json<{ id: string; slug: string }>();
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const w = await ctx.server.inject({
      method: 'POST',
      url: `/api/blessings/${id}/withdraw`,
      headers: ctx.auth,
    });
    expect(w.statusCode).toBe(200);

    const page = await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` });
    expect(page.json<{ type: string }>().type).toBe('withdrawn');
    const streak = await ctx.server.inject({
      method: 'GET',
      url: '/api/streak/me',
      headers: ctx.auth,
    });
    expect(streak.json<{ total: number }>().total).toBe(0);
    await ctx.server.close();
  });

  it('缺协议 → 提交 403 consent_required', async () => {
    const ctx = await makeServer();
    const login = await ctx.server.inject({
      method: 'POST',
      url: '/api/auth/stub-login',
      payload: { nickname: '无协议' },
    });
    const c = login.cookies.find((x) => x.name === 'bw_uid');
    const res = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: { cookie: `bw_uid=${c?.value ?? ''}` },
      payload: { body: GOOD_BODY, occasion: 'daily', personalization: { toName: '阿明' } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: string }>().error).toBe('consent_required');
    await ctx.server.close();
  });

  it('范本接口返回参考范本（每类≥3）', async () => {
    const ctx = await loggedInServer();
    const res = await ctx.server.inject({
      method: 'GET',
      url: '/api/templates',
      headers: ctx.auth,
    });
    const list = res.json<{ category: string }[]>();
    expect(list.length).toBeGreaterThanOrEqual(18);
    await ctx.server.close();
  });

  it('举报高危 → 即时占位 + 进审核队列 → 人工通过恢复', async () => {
    const ctx = await loggedInServer();
    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: ctx.auth,
      payload: { body: GOOD_BODY, occasion: 'daily', personalization: { toName: '阿明' } },
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

    const queue = await ctx.server.inject({
      method: 'GET',
      url: '/api/moderation/queue',
      headers: ctx.auth,
    });
    const items = queue.json<{ id: string; priority: number }[]>();
    expect(items[0]?.priority).toBe(90);

    await ctx.server.inject({
      method: 'POST',
      url: `/api/moderation/${items[0]?.id ?? ''}/resolve`,
      headers: ctx.auth,
      payload: { action: 'pass', reason: '误报' },
    });
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('content');
    await ctx.server.close();
  });

  it('命中护栏词 → suspect → 进队列 → 人工通过 → 送达（§7.2）', async () => {
    const ctx = await loggedInServer();
    const r = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: ctx.auth,
      payload: {
        body: '愿你平安，如需超度收费请私信我们，价格公道，服务周到。',
        occasion: 'remembrance',
        personalization: { toName: '故人' },
      },
    });
    const { slug } = r.json<{ slug: string }>();
    ctx.clock.advance(60000);
    await ctx.app.scans.publishReady();
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('preparing');

    const queue = (
      await ctx.server.inject({ method: 'GET', url: '/api/moderation/queue', headers: ctx.auth })
    ).json<{ id: string; origin: string }[]>();
    expect(queue.some((q) => q.origin === 'auto_suspect')).toBe(true);

    await ctx.server.inject({
      method: 'POST',
      url: `/api/moderation/${queue[0]?.id ?? ''}/resolve`,
      headers: ctx.auth,
      payload: { action: 'pass', reason: '常见悼念用语' },
    });
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('content');
    await ctx.server.close();
  });

  it('链接到期 → expired 占位 → 续期 → 恢复可见（不重新审核）（§7.3）', async () => {
    const ctx = await loggedInServer();
    const r = await ctx.server.inject({
      method: 'POST',
      url: '/api/blessings',
      headers: ctx.auth,
      payload: { body: GOOD_BODY, occasion: 'birthday', personalization: { toName: '阿明' } },
    });
    const { id, slug } = r.json<{ id: string; slug: string }>();
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    ctx.clock.advance(121 * 86_400_000);
    await ctx.app.scans.expire();
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('expired');

    await ctx.server.inject({
      method: 'POST',
      url: `/api/blessings/${id}/renew`,
      headers: ctx.auth,
    });
    expect(
      (await ctx.server.inject({ method: 'GET', url: `/api/p/${slug}` })).json<{ type: string }>()
        .type,
    ).toBe('content');
    // 续期不重复加计数
    const streak = (
      await ctx.server.inject({ method: 'GET', url: '/api/streak/me', headers: ctx.auth })
    ).json<{ total: number }>();
    expect(streak.total).toBe(1);
    await ctx.server.close();
  });
});
