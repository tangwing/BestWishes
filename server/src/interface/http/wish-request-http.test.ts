import { describe, it, expect } from 'vitest';
import { makeServer } from './test-server';
import { buildMultipartBody } from './test-multipart';

const CENTER = { lat: 30.2741, lng: 120.1551 };
const NEAR = { lat: 30.28, lng: 120.16 };

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

async function respond(
  ctx: Awaited<ReturnType<typeof makeServer>>,
  requestId: string,
  auth: { cookie: string },
  transcript: string,
  overrides: Partial<Record<'durationSec' | 'occasion', string>> = {},
) {
  const challengeRes = await ctx.server.inject({
    method: 'GET',
    url: '/api/audio-challenge',
    headers: auth,
  });
  const challenge = challengeRes.json<{ phrase: string; token: string }>();
  const { body, contentType } = buildMultipartBody(
    {
      // requestId 特意不放进表单字段——它来自 URL 参数，跟真实前端 client.ts 的行为
      // 保持一致（B-69 的教训：曾经服务端 schema 要求它重复出现在表单里，
      // 而真实浏览器客户端从没发过这个字段，422 一直没被测出来，因为这里手写的
      // 测试当时"贴心"地把它也塞了进去，掩盖了这个 bug）。
      durationSec: overrides.durationSec ?? '20',
      occasion: overrides.occasion ?? 'daily',
      challengeToken: challenge.token,
      clientTranscript: `${transcript}${transcript.includes(challenge.phrase) ? '' : `，${challenge.phrase}`}`,
    },
    { fieldName: 'audio', filename: 'a.webm', contentType: 'audio/webm', data: Buffer.from('x') },
  );
  return ctx.server.inject({
    method: 'POST',
    url: `/api/wish-requests/${requestId}/respond`,
    headers: { ...auth, 'content-type': contentType },
    payload: body,
  });
}

describe('HTTP 端到端：祝福请求 + 音频回应', () => {
  it('未登录能浏览广场，发布/回应要求登录', async () => {
    const ctx = await makeServer();
    const author = await login(ctx.server, '求祝福');
    await setProfile(ctx.server, author, CENTER);
    await agree(ctx.server, author);

    const noAuthPost = await ctx.server.inject({
      method: 'POST',
      url: '/api/wish-requests',
      payload: { situationText: '最近压力很大，想要一句鼓励。', tags: [] },
    });
    expect(noAuthPost.statusCode).toBe(401);

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/wish-requests',
      headers: author,
      payload: { situationText: '最近压力很大，想要一句鼓励。', tags: [] },
    });
    expect(submit.statusCode).toBe(200);

    const plaza = await ctx.server.inject({ method: 'GET', url: '/api/wish-requests' });
    expect(plaza.statusCode).toBe(200);
    expect(plaza.json<{ id: string }[]>().length).toBeGreaterThan(0);

    await ctx.server.close();
  });

  it('完整链路：发布 → 录音回应（真实 multipart 编码）→ hold 后送达 → 请求人拉音频文件', async () => {
    const ctx = await makeServer();
    const author = await login(ctx.server, '求祝福的人');
    await setProfile(ctx.server, author, CENTER);
    await agree(ctx.server, author);

    const responder = await login(ctx.server, '回应者');
    await setProfile(ctx.server, responder, NEAR);
    await agree(ctx.server, responder);

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/wish-requests',
      headers: author,
      payload: {
        situationText: '最近考研压力很大，每天都很焦虑，希望有人能鼓励我一下。',
        scriptText: '愿你放下焦虑，一步一步来。',
        tags: [],
      },
    });
    expect(submit.statusCode).toBe(200);
    const { id: requestId } = submit.json<{ id: string }>();

    const res = await respond(ctx, requestId, responder, '愿你放下焦虑，一步一步来，你已经很努力了');
    expect(res.statusCode).toBe(200);
    const { id: blessingId, state } = res.json<{ id: string; state: string }>();
    expect(state).toBe('verifying');

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const inbox = await ctx.server.inject({ method: 'GET', url: '/api/inbox', headers: author });
    expect(inbox.json<unknown[]>()).toHaveLength(1);

    const responses = await ctx.server.inject({
      method: 'GET',
      url: `/api/wish-requests/${requestId}/responses`,
      headers: author,
    });
    expect(responses.statusCode).toBe(200);
    expect(responses.json<{ fromNickname: string }[]>()[0]?.fromNickname).toBe('回应者');

    // 请求人能拉音频文件
    const audioAsAuthor = await ctx.server.inject({
      method: 'GET',
      url: `/api/blessings/${blessingId}/audio`,
      headers: author,
    });
    expect(audioAsAuthor.statusCode).toBe(200);
    expect(audioAsAuthor.body).toBe('x');

    // 回应者自己也能拉（收发双方都行）
    const audioAsResponder = await ctx.server.inject({
      method: 'GET',
      url: `/api/blessings/${blessingId}/audio`,
      headers: responder,
    });
    expect(audioAsResponder.statusCode).toBe(200);

    // 回应者能看到自己的多维反馈
    const feedback = await ctx.server.inject({
      method: 'GET',
      url: `/api/blessings/${blessingId}/audio-feedback`,
      headers: responder,
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json()).not.toBeNull();

    await ctx.server.close();
  });

  it('不相关的第三方拉不到音频文件（403）', async () => {
    const ctx = await makeServer();
    const author = await login(ctx.server, '求祝福的人2');
    await setProfile(ctx.server, author, CENTER);
    await agree(ctx.server, author);
    const responder = await login(ctx.server, '回应者2');
    await setProfile(ctx.server, responder, NEAR);
    await agree(ctx.server, responder);
    const stranger = await login(ctx.server, '路人');

    const submit = await ctx.server.inject({
      method: 'POST',
      url: '/api/wish-requests',
      headers: author,
      payload: { situationText: '希望有人能鼓励我一下，最近很低落。', tags: [] },
    });
    const { id: requestId } = submit.json<{ id: string }>();
    const res = await respond(ctx, requestId, responder, '愿你被这个世界温柔以待，一切都会好起来的');
    const { id: blessingId } = res.json<{ id: string }>();

    const forbidden = await ctx.server.inject({
      method: 'GET',
      url: `/api/blessings/${blessingId}/audio`,
      headers: stranger,
    });
    expect(forbidden.statusCode).toBe(403);

    await ctx.server.close();
  });
});
