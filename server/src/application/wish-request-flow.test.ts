import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
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

async function plazaIds(ctx: App, filter: 'all' | 'mine' = 'all', viewer: string | null = null): Promise<string[]> {
  const r = await ctx.app.wishRequests.plaza(viewer, filter);
  if (!r.ok) throw new Error('plaza failed');
  return r.value.map((p) => p.id);
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

    expect(await plazaIds(ctx)).toContain(r.value.id);

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

    expect(await plazaIds(ctx)).toContain(r.value.id);
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
    // B-93：请求人在福袋里点开这条音频回应，得能放录音——只有转写文字的话，
    // 这段文字看起来就像一条跟录音毫无关系的普通善意，没有"绑"在一起的感觉。
    expect(inbox[0]?.contentType).toBe('audio');
    expect(inbox[0]?.mediaUrl).toBeTruthy();

    const detail = await ctx.app.wishRequests.detail(r.value.id, author);
    if (!detail) throw new Error('detail failed');
    expect(detail.responses).toHaveLength(1);
    expect(detail.responses[0]?.fromNickname).toBe('回应者');
    // 聚合计数对账：responseCount 与实际 published 回应数一致
    expect(detail.responseCount).toBe(1);
    const publishedResponses = (await ctx.repos.blessings.listByRequestId(r.value.id)).filter(
      (b) => b.state === 'published',
    );
    expect(detail.responseCount).toBe(publishedResponses.length);

    const feedback = await ctx.app.audioScoring.myFeedback(responder, submitted.value.id);
    expect(feedback.ok).toBe(true);
    if (!feedback.ok) return;
    expect(feedback.value.status).toBe('scored');
    if (feedback.value.status !== 'scored') return;
    expect(feedback.value.completeness).toBe('complete');

    // B-85：回应者自己在"我的善意"（outbox）里要能放这段录音，不能只看到转写文字
    const responderOutbox = await ctx.app.blessings.outbox(responder);
    const own = responderOutbox.find((o) => o.id === submitted.value.id);
    expect(own?.contentType).toBe('audio');
    expect(own?.mediaUrl).toBeTruthy();
  });

  it('B-89：请求人能回复一条音频回应，回复出现在祈福详情的连续回复里，回应者也能回过去', async () => {
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
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    // 请求人回复这条音频回应
    const reply1 = await ctx.app.blessings.submit(author, {
      contentType: 'text',
      body: '谢谢你，真的很温暖，谢谢你愿意花时间录这段。',
      occasion: 'daily',
      scope: 'reply',
      replyToUserId: responder,
      replyToBlessingId: submitted.value.id,
    });
    expect(reply1.ok).toBe(true);
    if (!reply1.ok) return;
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    let detail = await ctx.app.wishRequests.detail(r.value.id, responder);
    expect(detail?.responses[0]?.replies).toHaveLength(1);
    expect(detail?.responses[0]?.replies[0]?.fromUserId).toBe(author);
    expect(detail?.responses[0]?.replies[0]?.body).toContain('谢谢你');

    // 回应者能接着回过去，形成往返（回复目标是请求人刚发的那条回复）
    const reply2 = await ctx.app.blessings.submit(responder, {
      contentType: 'text',
      body: '不客气，希望你一切顺利！',
      occasion: 'daily',
      scope: 'reply',
      replyToUserId: author,
      replyToBlessingId: reply1.value.id,
    });
    expect(reply2.ok).toBe(true);
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    detail = await ctx.app.wishRequests.detail(r.value.id, author);
    const replies = detail?.responses[0]?.replies ?? [];
    expect(replies).toHaveLength(2);
    // 按时间正序：先是请求人的感谢，再是回应者的回复
    expect(replies[0]?.fromUserId).toBe(author);
    expect(replies[1]?.fromUserId).toBe(responder);
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

  it('不填补充文字 → 转人工复核，不会被误判违规驳回（B-88：文字不再强制）', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();

    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 4,
      occasion: 'daily',
      challengeToken: challenge.token,
      // 故意不传 clientTranscript——RuleBasedProvider 对空文本会判"低有效内容"，
      // 曾经因此被直接判 violation 驳回，等于"不写字就必被拒"，跟"取消强制"的
      // 初衷正好相反。
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.state).toBe('verifying'); // 不是 rejected

    const queue = await ctx.app.moderationQueue.queue();
    expect(queue.some((q) => q.blessing?.id === submitted.value.id)).toBe(true);
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

    // 关键：区分"驳回、永远不会有反馈"和"还在评估中"——不能都返回同一个 null
    // （B-76：曾经两者不可区分，前端把"驳回"误显示成"发出成功"）
    const feedback = await ctx.app.audioScoring.myFeedback(responder, submitted.value.id);
    expect(feedback.ok).toBe(true);
    if (!feedback.ok) return;
    expect(feedback.value.status).toBe('rejected');
    if (feedback.value.status !== 'rejected') return;
    expect(feedback.value.categories).toContain('fraud');

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

    expect(await plazaIds(ctx)).not.toContain(r.value.id);

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
    expect(await plazaIds(ctx)).not.toContain(r.value.id);
    const beforeNotif = await ctx.app.notifications.list(responder);
    expect(beforeNotif.items.some((n) => n.requestId === r.value.id)).toBe(false);

    const queue = await ctx.app.moderationQueue.queue();
    const ticket = queue.find((q) => q.wishRequest?.id === r.value.id);
    expect(ticket).toBeDefined();
    expect(ticket?.wishRequest?.state).toBe('pending_review');

    await ctx.app.moderationQueue.resolve(ticket!.id, 'pass', '误判，正常求助', author);

    // 通过后才公开、才触发匹配推送
    expect(await plazaIds(ctx)).toContain(r.value.id);
    const afterNotif = await ctx.app.notifications.list(responder);
    expect(afterNotif.items.some((n) => n.requestId === r.value.id)).toBe(true);
  });

  it('祈福广场列表只给摘要 + 统计，不含任何回应内容', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      scriptText: SCRIPT,
      tags: [],
    });
    if (!r.ok) throw new Error('publish failed');

    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: `${SCRIPT}。${challenge.phrase}`,
    });
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    const item = list.value.find((p) => p.id === r.value.id);
    expect(item).toBeDefined();
    expect(item?.responseCount).toBe(1);
    // 摘要项的字段里没有任何 "回应内容" 形态的东西
    expect(JSON.stringify(item)).not.toContain('fake-audio');
    expect(Object.keys(item ?? {})).not.toContain('responses');
    expect(Object.keys(item ?? {})).not.toContain('situationText'); // 只有 situationExcerpt
  });

  it('回应撤回后 responseCount 回落，且与实际 published 回应数一致', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    let detail = await ctx.app.wishRequests.detail(r.value.id, author);
    expect(detail?.responseCount).toBe(1);

    await ctx.app.blessings.withdraw(responder, submitted.value.id);

    detail = await ctx.app.wishRequests.detail(r.value.id, author);
    expect(detail?.responseCount).toBe(0);
    expect(detail?.responses).toHaveLength(0);
    const published = (await ctx.repos.blessings.listByRequestId(r.value.id)).filter(
      (b) => b.state === 'published',
    );
    expect(detail?.responseCount).toBe(published.length);
  });

  it('plaza() 不遍历回应表——摘录来自 wishRequests 记录本身，读放大不随回应数增长', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const spy = vi.spyOn(ctx.repos.blessings, 'listByRequestId');
    const list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    expect(list.value.find((p) => p.id === r.value.id)?.lastResponseExcerpt).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('回应发布后，广场列表项的 lastResponseExcerpt 等于这条回应的摘录', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');

    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const transcript = goodTranscript(challenge.phrase);
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: transcript,
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    const item = list.value.find((p) => p.id === r.value.id);
    expect(item?.lastResponseExcerpt).toBeTruthy();
    expect(transcript.startsWith(item?.lastResponseExcerpt?.replace(/…$/, '') ?? '\0')).toBe(true);
  });

  it('两条回应，撤回最新那条后摘录退回到第二新的那条；再撤回后摘录为 null 且 responseCount 为 0', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const requestId = r.value.id;

    async function respond(makeTranscript: (phrase: string) => string) {
      const challenge = ctx.app.audioScoring.issueLivenessChallenge();
      const clientTranscript = makeTranscript(challenge.phrase);
      const submitted = await ctx.app.audioScoring.submit(responder, {
        requestId,
        audio: Buffer.from('fake-audio-bytes'),
        durationSec: 25,
        occasion: 'daily',
        challengeToken: challenge.token,
        clientTranscript,
      });
      if (!submitted.ok) throw new Error('submit failed');
      ctx.clock.advance(6000);
      await ctx.app.scans.publishReady();
      return { id: submitted.value.id, transcript: clientTranscript };
    }

    const first = await respond((phrase) => goodTranscript(phrase));
    const second = await respond((phrase) => `第二条回应。${goodTranscript(phrase)}`);
    const firstId = first.id;
    const firstTranscript = first.transcript;
    const secondId = second.id;

    let detail = await ctx.app.wishRequests.detail(r.value.id, author);
    expect(detail?.responseCount).toBe(2);

    await ctx.app.blessings.withdraw(responder, secondId);
    let list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    let item = list.value.find((p) => p.id === r.value.id);
    expect(item?.responseCount).toBe(1);
    expect(firstTranscript.startsWith(item?.lastResponseExcerpt?.replace(/…$/, '') ?? '\0')).toBe(
      true,
    );

    await ctx.app.blessings.withdraw(responder, firstId);
    list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    item = list.value.find((p) => p.id === r.value.id);
    expect(item?.responseCount).toBe(0);
    expect(item?.lastResponseExcerpt).toBeNull();
  });

  it('匿名发布：广场与详情显示"一位朋友"、不带城市，响应体不含真实昵称', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      tags: [],
      anonymous: true,
    });
    if (!r.ok) throw new Error('publish failed');
    expect(r.value.authorNickname).toBe('一位朋友');
    expect(r.value.authorCity).toBeNull();

    const list = await ctx.app.wishRequests.plaza(null, 'all');
    if (!list.ok) throw new Error('plaza failed');
    const item = list.value.find((p) => p.id === r.value.id);
    expect(item?.authorNickname).toBe('一位朋友');
    expect(item?.authorCity).toBeNull();
    expect(JSON.stringify(item)).not.toContain('求祝福的人');

    const detail = await ctx.app.wishRequests.detail(r.value.id, responder);
    expect(detail?.authorNickname).toBe('一位朋友');
    expect(detail?.authorCity).toBeNull();
    expect(JSON.stringify(detail)).not.toContain('求祝福的人');
  });

  it('匿名发布：匹配通知的文案也不带真实昵称', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      tags: ['考研'],
      anonymous: true,
    });
    if (!r.ok) throw new Error('publish failed');

    const notifications = await ctx.app.notifications.list(responder);
    const matched = notifications.items.find((n) => n.kind === 'wish_request_matched');
    expect(matched?.from.nickname).toBe('一位朋友');
    expect(JSON.stringify(matched)).not.toContain('求祝福的人');
  });

  it('匿名不影响：作者自己仍能在 mine 筛选里看到、仍可撤回', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      tags: [],
      anonymous: true,
    });
    if (!r.ok) throw new Error('publish failed');

    expect(await plazaIds(ctx, 'mine', author)).toContain(r.value.id);

    const withdrawn = await ctx.app.wishRequests.withdraw(author, r.value.id);
    expect(withdrawn.ok).toBe(true);
    const mineAfter = await ctx.app.wishRequests.plaza(author, 'mine');
    if (!mineAfter.ok) throw new Error('plaza failed');
    const item = mineAfter.value.find((p) => p.id === r.value.id);
    expect(item?.state).toBe('withdrawn');
    // 撤回这类既有的写入路径不会顺带把匿名标记改掉——展示仍是"一位朋友"
    expect(item?.authorNickname).toBe('一位朋友');
  });

  it('匿名不影响审核追责：命中疑似的匿名请求，工单仍指向真实作者', async () => {
    const r = await ctx.app.wishRequests.publish(author, {
      situationText: '最近很焦虑，加我微信详细聊聊，希望有人能鼓励我一下。',
      tags: [],
      anonymous: true,
    });
    if (!r.ok) throw new Error('publish failed');
    expect(r.value.state).toBe('pending_review');

    const queue = await ctx.app.moderationQueue.queue();
    const ticket = queue.find((q) => q.wishRequest?.id === r.value.id);
    expect(ticket).toBeDefined();
    const raw = await ctx.repos.wishRequests.findById(r.value.id);
    expect(raw?.authorId).toBe(author);
    expect(raw?.anonymous).toBe(true);
  });

  it('第三方登录用户可回放一条 published 祈福的音频回应（既有权限缺口收口）', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const thirdParty = await seedUser(ctx, { nickname: '路人甲' });
    const played = await ctx.app.audioScoring.readAudio(thirdParty, submitted.value.id);
    expect(played.ok).toBe(true);
  });

  it('回归：非作者非收件人回放一条 P1 群发音频仍 403（放宽只针对祈福回应）', async () => {
    // P1 目前没有任何公开入口能真的建出一条 contentType='audio' 的群发祝福
    // （blessing-service.submit 对所有 scope 都拒绝非 text），这里直接落库模拟，
    // 专门守住"放宽范围只限祈福回应"这条边界。
    const thirdParty = await seedUser(ctx, { nickname: '路人乙' });
    const broadcastAudio = {
      id: 'bls_broadcast_audio_1',
      authorId: author,
      contentType: 'audio' as const,
      body: '',
      media: { url: 'x', durationSec: 10, transcript: '转写文本' },
      occasion: 'daily' as const,
      scope: 'broadcast' as const,
      audience: { radiusKm: 5, ageMin: null, ageMax: null, gender: 'any' as const, tags: [] },
      replyToUserId: null,
      replyToBlessingId: null,
      requestId: null,
      recipientIds: [responder],
      state: 'published' as const,
      slug: 'slug-broadcast-audio-1',
      createdAt: ctx.clock.now().toISOString(),
      publishedAt: ctx.clock.now().toISOString(),
      deliveredAt: ctx.clock.now().toISOString(),
      expiresAt: null,
      moderation: null,
      renewCount: 0,
      countedInStreak: true,
      holdUntil: null,
      events: [],
    };
    await ctx.repos.blessings.add(broadcastAudio);

    const played = await ctx.app.audioScoring.readAudio(thirdParty, broadcastAudio.id);
    expect(played.ok).toBe(false);
    if (!played.ok) expect(played.error.code).toBe('forbidden');
  });

  it('详情：访客读得到文字，读不到音频链接；登录后同一条含音频链接', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const transcript = goodTranscript(challenge.phrase);
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: transcript,
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();

    const guestView = await ctx.app.wishRequests.detail(r.value.id, null);
    expect(guestView?.situationText).toBe(SITUATION);
    expect(guestView?.responses[0]?.transcript).toBeTruthy();
    expect(guestView?.responses[0]?.audioUrl).toBeNull();
    expect(guestView?.responses[0]?.audioLocked).toBe(true);
    expect(JSON.stringify(guestView)).not.toMatch(/"audioUrl":"[^"]/); // 不含任何真实音频链接

    const thirdParty = await seedUser(ctx, { nickname: '路人丙' });
    const loggedInView = await ctx.app.wishRequests.detail(r.value.id, thirdParty);
    expect(loggedInView?.responses[0]?.audioUrl).toBeTruthy();
    expect(loggedInView?.responses[0]?.audioLocked).toBe(false);
  });

  it('权限矩阵：{访客/第三方/收件人/作者} × {祈福回应音频/群发音频} × {详情文字/音频回放}', async () => {
    const r = await ctx.app.wishRequests.publish(author, { situationText: SITUATION, tags: [] });
    if (!r.ok) throw new Error('publish failed');
    const challenge = ctx.app.audioScoring.issueLivenessChallenge();
    const submitted = await ctx.app.audioScoring.submit(responder, {
      requestId: r.value.id,
      audio: Buffer.from('fake-audio-bytes'),
      durationSec: 25,
      occasion: 'daily',
      challengeToken: challenge.token,
      clientTranscript: goodTranscript(challenge.phrase),
    });
    if (!submitted.ok) throw new Error('submit failed');
    ctx.clock.advance(6000);
    await ctx.app.scans.publishReady();
    const wishResponseAudioId = submitted.value.id;

    const thirdParty = await seedUser(ctx, { nickname: '路人丁' });

    // 祈福回应音频：详情文字对访客可读；readAudio 对 {作者(收件人)/回应者(作者)/第三方登录} 全部放行
    const guestDetail = await ctx.app.wishRequests.detail(r.value.id, null);
    expect(guestDetail?.situationText).toBeTruthy();
    for (const viewer of [author, responder, thirdParty]) {
      const played = await ctx.app.audioScoring.readAudio(viewer, wishResponseAudioId);
      expect(played.ok).toBe(true);
    }

    // 群发音频（直接落库模拟，P1 无公开入口创建）：只有作者 / 收件人能听，第三方仍 403
    const broadcastAudio = {
      id: 'bls_matrix_broadcast_audio',
      authorId: author,
      contentType: 'audio' as const,
      body: '',
      media: { url: 'x', durationSec: 10, transcript: '转写文本' },
      occasion: 'daily' as const,
      scope: 'broadcast' as const,
      audience: { radiusKm: 5, ageMin: null, ageMax: null, gender: 'any' as const, tags: [] },
      replyToUserId: null,
      replyToBlessingId: null,
      requestId: null,
      recipientIds: [responder],
      state: 'published' as const,
      slug: 'slug-matrix-broadcast-audio',
      createdAt: ctx.clock.now().toISOString(),
      publishedAt: ctx.clock.now().toISOString(),
      deliveredAt: ctx.clock.now().toISOString(),
      expiresAt: null,
      moderation: null,
      renewCount: 0,
      countedInStreak: true,
      holdUntil: null,
      events: [],
    };
    await ctx.repos.blessings.add(broadcastAudio);
    // readAudio 通过权限判定后会去磁盘读文件——这里直接写一份，落库模拟走的是同一条本地存储路径
    await mkdir('/tmp/bestwishes-test-audio', { recursive: true });
    await writeFile(`/tmp/bestwishes-test-audio/${broadcastAudio.id}.webm`, 'fake-audio-bytes');
    expect((await ctx.app.audioScoring.readAudio(author, broadcastAudio.id)).ok).toBe(true);
    expect((await ctx.app.audioScoring.readAudio(responder, broadcastAudio.id)).ok).toBe(true);
    expect((await ctx.app.audioScoring.readAudio(thirdParty, broadcastAudio.id)).ok).toBe(false);
  });

  it('"我的祈福"筛选：只列自己的，含 pending_review / withdrawn', async () => {
    const mine = await ctx.app.wishRequests.publish(author, {
      situationText: SITUATION,
      tags: [],
    });
    if (!mine.ok) throw new Error('publish failed');
    const suspect = await ctx.app.wishRequests.publish(author, {
      situationText: '最近很焦虑，加我微信详细聊聊，希望有人能鼓励我一下。',
      tags: [],
    });
    if (!suspect.ok) throw new Error('publish failed');
    const others = await ctx.app.wishRequests.publish(responder, {
      situationText: SITUATION,
      tags: [],
    });
    if (!others.ok) throw new Error('publish failed');

    const ids = await plazaIds(ctx, 'mine', author);
    expect(ids).toContain(mine.value.id);
    expect(ids).toContain(suspect.value.id); // pending_review 也在"我的"里
    expect(ids).not.toContain(others.value.id);

    // 默认广场只列 published
    const all = await plazaIds(ctx, 'all');
    expect(all).not.toContain(suspect.value.id);
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

    expect(await plazaIds(ctx)).not.toContain(r.value.id);
    const stillPendingWithdraw = await ctx.app.wishRequests.withdraw(author, r.value.id);
    expect(stillPendingWithdraw.ok).toBe(false); // 已经是终态，连撤回都不行
  });
});
