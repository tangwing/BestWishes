import { describe, it, expect, beforeEach } from 'vitest';
import { makeApp, seedUser } from './test-harness';

type App = ReturnType<typeof makeApp>;

const CENTER = { lat: 30.2741, lng: 120.1551 };
const NEAR = { lat: 30.28, lng: 120.16 }; // ~1km
const FAR = { lat: 31.2304, lng: 121.4737 }; // 上海 ~170km

const SITUATION = '最近考研压力很大，每天都很焦虑，希望有人能鼓励我一下。';
const SCRIPT = '愿你放下焦虑，一步一步来，你已经很努力了。';

/** 构造一段"通过安全检查 + 呼应处境 + 带上验证词"的转写文本，覆盖大部分正常场景。 */
function goodTranscript(phrase: string): string {
  return `听说你最近考研压力很大，${phrase}，愿你放下焦虑，一步一步来，你已经很努力了，一切都会好起来的。`;
}

describe('祝福请求 + 音频回应', () => {
  let ctx: App;
  let author: string;
  let responder: string;

  beforeEach(async () => {
    ctx = makeApp();
    author = await seedUser(ctx, {
      nickname: '求祝福的人',
      consent: true,
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    responder = await seedUser(ctx, {
      nickname: '回应者',
      consent: true,
      lat: NEAR.lat,
      lng: NEAR.lng,
      tags: ['考研'],
    });
  });

  it('发布请求 → 进广场 → 按标签匹配到候选人并收到通知', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      scriptText: SCRIPT,
      tags: ['考研'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const plaza = await ctx.app.wishRequests.plaza();
    expect(plaza.map((p) => p.id)).toContain(r.value.id);

    const notifications = await ctx.app.notifications.list(responder);
    const matched = notifications.items.find((n) => n.kind === 'wish_request_matched');
    expect(matched?.requestId).toBe(r.value.id);
  });

  it('不匹配标签、距离太远的人不会被匹配推送，但仍能在广场看到', async () => {
    await seedUser(ctx, { nickname: '路人', lat: FAR.lat, lng: FAR.lng, tags: ['考研'] });
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      tags: ['考研'],
    });
    if (!r.ok) throw new Error('publish failed');

    const plaza = await ctx.app.wishRequests.plaza();
    expect(plaza.map((p) => p.id)).toContain(r.value.id);
  });

  it('不能回应自己发布的请求', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');

    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const result = await ctx.app.audioScoring.submit(author, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio'),
      durationSec: 20,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    expect(result.ok).toBe(false);
  });

  it('完整链路：录音回应 → 打分 → hold 后送达请求人 → 回应者能看到自己的反馈', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      scriptText: SCRIPT,
      tags: [],
    });
    if (!r.ok) throw new Error('publish failed');

    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: `${SCRIPT}。${challenge.phrase}`,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.state).toBe('verifying');

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const inbox = await ctx.app.inbox.list(author);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.status).toBe('content');

    const responses = await ctx.app.wishRequests.responses(author, r.value.id);
    if (!responses.ok) throw new Error('responses failed');
    expect(responses.value).toHaveLength(1);
    expect(responses.value[0]?.fromNickname).toBe('回应者');

    const feedback = await ctx.app.audioScoring.myFeedback(responder, submitted.value.id);
    expect(feedback.ok).toBe(true);
    if (!feedback.ok) return;
    expect(feedback.value).not.toBeNull();
    expect(feedback.value?.completeness).toBe('complete');
  });

  it('录音时长超出范围 → 拒绝', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    const tooShort = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 1,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    expect(tooShort.ok).toBe(false);

    const tooLong = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 999,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    expect(tooLong.ok).toBe(false);
  });

  it('转写命中违禁词 → 驳回，不产生打分反馈', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 20,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: `刷单返利，加入我们，${challenge.phrase}`,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.state).toBe('rejected');

    const feedback = await ctx.app.audioScoring.myFeedback(responder, submitted.value.id);
    expect(feedback.ok).toBe(true);
    if (!feedback.ok) return;
    expect(feedback.value).toBeNull();

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    expect(await ctx.app.inbox.list(author)).toHaveLength(0);
  });

  it('转写命中拉客护栏词 → suspect，进人工队列，不立即送达', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 20,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: `加我微信详细聊，${challenge.phrase}`,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.state).toBe('verifying');

    // 即使打分完成了，suspect 状态下 hold 未设，不会被 publishReady 扫上
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    expect(await ctx.app.inbox.list(author)).toHaveLength(0);

    const queue = await ctx.app.moderationQueue.queue();
    expect(queue.some((q) => q.blessing?.id === submitted.value.id)).toBe(true);
  });

  it('真人校验未通过（转写里没有验证词）→ 转人工复核，不直接送达', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 20,
      occasion: 'daily',
      // 故意不包含 challenge.phrase
      challengeToken: challenge.token,
      clientTranscript: '愿你一切都好，加油。',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    expect(await ctx.app.inbox.list(author)).toHaveLength(0);

    const queue = await ctx.app.moderationQueue.queue();
    expect(queue.some((q) => q.blessing?.id === submitted.value.id)).toBe(true);
  });

  it('验证 token 过期 → 拒绝提交', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    ctx.clock.advance(6 * 60 * 1000); // 挑战有效期 5 分钟

    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 20,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    expect(submitted.ok).toBe(false);
  });

  it('撤回请求后不能再回应，广场里也看不到', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');

    const withdrawn = await ctx.app.wishRequests.withdraw(author, r.value.id);
    expect(withdrawn.ok).toBe(true);

    const plaza = await ctx.app.wishRequests.plaza();
    expect(plaza.map((p) => p.id)).not.toContain(r.value.id);

    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('x'),
      durationSec: 20,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    expect(submitted.ok).toBe(false);
  });

  it('只能撤回，不能重新发布（终态，同 blessing-delivery 的规则）', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    await ctx.app.wishRequests.withdraw(author, r.value.id);

    const secondWithdraw = await ctx.app.wishRequests.withdraw(author, r.value.id);
    expect(secondWithdraw.ok).toBe(false);
  });

  it('处境描述命中违禁词 → 拒绝发布', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: '刷单返利，加入我们就能赚钱，最近压力很大希望有人鼓励我。',
      tags: [],
    });
    expect(r.ok).toBe(false);
  });

  it('处境描述命中拉客护栏词 → 广场看不到、不触发匹配，进人工队列；人工通过后才公开 + 匹配推送', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: '最近很焦虑，加我微信详细聊聊，希望有人能鼓励我一下。',
      tags: ['考研'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // 命中疑似的这段时间：广场看不到，responder 也没收到匹配通知
    expect((await ctx.app.wishRequests.plaza()).map((p) => p.id)).not.toContain(r.value.id);
    const beforeNotif = await ctx.app.notifications.list(responder);
    expect(beforeNotif.items.some((n) => n.requestId === r.value.id)).toBe(false);

    const queue = await ctx.app.moderationQueue.queue();
    const ticket = queue.find((q) => q.wishRequest?.id === r.value.id);
    expect(ticket).toBeDefined();
    expect(ticket?.wishRequest?.state).toBe('pending_review');

    await ctx.app.moderationQueue.resolve(ticket!.id, 'pass', '误判，正常求助', author);

    // 通过后才公开、才触发匹配推送
    expect((await ctx.app.wishRequests.plaza()).map((p) => p.id)).toContain(r.value.id);
    const afterNotif = await ctx.app.notifications.list(responder);
    expect(afterNotif.items.some((n) => n.requestId === r.value.id)).toBe(true);
  });

  it('人工驳回一条待审的请求 → 直接进终态，不公开', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: '最近很焦虑，加我微信详细聊聊，希望有人能鼓励我一下。',
      tags: [],
    });
    if (!r.ok) throw new Error('publish failed');

    const queue = await ctx.app.moderationQueue.queue();
    const ticket = queue.find((q) => q.wishRequest?.id === r.value.id);
    await ctx.app.moderationQueue.resolve(ticket!.id, 'takedown', '确实不合适', author);

    expect((await ctx.app.wishRequests.plaza()).map((p) => p.id)).not.toContain(r.value.id);
    const stillPendingWithdraw = await ctx.app.wishRequests.withdraw(author, r.value.id);
    expect(stillPendingWithdraw.ok).toBe(false); // 已经是终态，连撤回都不行
  });
});
