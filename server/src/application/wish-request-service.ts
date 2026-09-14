// 祈福（祝福请求）：撰写、发布（含内容安全检查 + 触发匹配推送）、生命周期（撤回是终态，
// 同 blessing-delivery 的教训，不提供重新发布）、祈福广场（Topic 列表，只给摘要 + 聚合统计）、
// 祈福详情（点进去才看回应）。回应数聚合在 blessing-write 的 transitionAndPersist 里增量维护。

import { applyWishRequestTrigger, outcomeFor, type AudienceFilter } from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import { AGREEMENT_VERSION, type AppDeps } from './deps';
import { createAudienceService } from './audience-service';
import type { WishRequestRecord } from '../ports/records';

export interface SubmitWishRequestInput {
  situationText: string;
  scriptText?: string | undefined;
  tags: string[];
  anonymous?: boolean | undefined;
}

const EXCERPT_LEN = 80;

/** 祈福广场列表项：只有摘要 + 聚合统计，绝不含任何回应内容。 */
export interface WishRequestSummary {
  id: string;
  authorNickname: string;
  authorCity: string | null;
  situationExcerpt: string;
  tags: string[];
  responseCount: number;
  lastResponseAt: string | null;
  /** 最新一条 published 回应的正文 / 转写摘录；尚无回应或无转写时为 null。 */
  lastResponseExcerpt: string | null;
  state: string;
  createdAt: string;
  isMine: boolean;
}

/** 一条回应下面的往返回复（文字，scope='reply' 链）。 */
export interface ReplyView {
  id: string;
  fromUserId: string;
  fromNickname: string;
  body: string;
  createdAt: string;
}

/** 祈福详情里的一条回应，以及它下面连续的往返回复（B-89：祈福是 Topic，回应下要有对话）。 */
export interface ResponseView {
  id: string;
  fromUserId: string;
  fromNickname: string;
  fromCity: string | null;
  audioUrl: string | null;
  /** true = 这条回应有音频，但当前访客未登录，看不到 audioUrl——用于前端显示"登录后可收听"
   * 而不是把它和"这条回应本来就没有音频"混为一谈。 */
  audioLocked: boolean;
  transcript: string | null;
  createdAt: string;
  replies: ReplyView[];
}

/** 祈福详情：处境全文 + 稿子 + 聚合统计 + 全部 published 回应。不含回应者评分细节。 */
export interface WishRequestDetail {
  id: string;
  authorId: string;
  authorNickname: string;
  authorCity: string | null;
  situationText: string;
  scriptText: string | null;
  tags: string[];
  responseCount: number;
  lastResponseAt: string | null;
  state: string;
  createdAt: string;
  isMine: boolean;
  responses: ResponseView[];
}

function charCount(s: string): number {
  return Array.from(s.trim()).length;
}

function excerpt(s: string): string {
  const chars = Array.from(s.trim());
  return chars.length <= EXCERPT_LEN ? s.trim() : `${chars.slice(0, EXCERPT_LEN).join('')}…`;
}

export function createWishRequestService(deps: AppDeps) {
  const audience = createAudienceService(deps);

  const MAX_REPLY_DEPTH = 20;

  /** 沿 replyToBlessingId 链往下走，拼出一条回应下面连续的往返回复，按时间正序。
   * 深度封顶纯为兜底（正常情况下这是个 DAG，不会成环）。 */
  async function collectReplyChain(rootId: string, depth = 0): Promise<ReplyView[]> {
    if (depth >= MAX_REPLY_DEPTH) return [];
    const children = await deps.repos.blessings.listRepliesTo(rootId);
    const out: ReplyView[] = [];
    for (const c of children) {
      if (c.state !== 'published') continue; // 未过审 / 已撤回的不展示
      const [sender, senderProfile] = await Promise.all([
        deps.repos.users.findById(c.authorId),
        deps.repos.profiles.get(c.authorId),
      ]);
      out.push({
        id: c.id,
        fromUserId: c.authorId,
        fromNickname: senderProfile?.senderName ?? sender?.nickname ?? '一位朋友',
        body: c.body,
        createdAt: c.publishedAt ?? c.createdAt,
      });
      out.push(...(await collectReplyChain(c.id, depth + 1)));
    }
    return out.sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1));
  }

  /** 匿名祈福在广场 / 详情 / 匹配通知里 MUST 以"一位朋友"代替昵称、不带城市——
   * 遮蔽在这里（服务端组装视图时）完成，不能把真实昵称发给前端再让前端选择不显示（design D4）。 */
  async function authorInfo(
    authorId: string,
    anonymous: boolean,
  ): Promise<{ nickname: string; city: string | null }> {
    if (anonymous) return { nickname: '一位朋友', city: null };
    const [user, profile] = await Promise.all([
      deps.repos.users.findById(authorId),
      deps.repos.profiles.get(authorId),
    ]);
    return {
      nickname: profile?.senderName ?? user?.nickname ?? '一位朋友',
      city: profile?.regionCity ?? null,
    };
  }

  async function toSummary(r: WishRequestRecord, viewerId: string | null): Promise<WishRequestSummary> {
    const a = await authorInfo(r.authorId, r.anonymous);
    return {
      id: r.id,
      authorNickname: a.nickname,
      authorCity: a.city,
      situationExcerpt: excerpt(r.situationText),
      tags: r.tags,
      responseCount: r.responseCount,
      lastResponseAt: r.lastResponseAt,
      lastResponseExcerpt: r.lastResponseExcerpt,
      state: r.state,
      createdAt: r.createdAt,
      isMine: viewerId !== null && r.authorId === viewerId,
    };
  }

  /** 发布时按标签 + 距离算候选响应人快照，逐个建 wish_request_matched 通知。
   * 零候选人不阻止发布——广场本身就是发现路径，匹配只是锦上添花。 */
  async function matchAndNotify(request: WishRequestRecord): Promise<string[]> {
    const filter: AudienceFilter = {
      radiusKm: deps.config.audienceMaxRadiusKm,
      ageMin: null,
      ageMax: null,
      gender: 'any',
      tags: request.tags,
    };
    const resolved = await audience.resolve(request.authorId, filter);
    if (!resolved.ok) return []; // 请求人自己没设位置：只能靠广场发现，不报错

    const now = deps.clock.now().toISOString();
    const candidateIds = resolved.value.matches.map((m) => m.candidate.userId);
    for (const candidateId of candidateIds) {
      await deps.repos.notifications.add({
        id: deps.ids.next('ntf'),
        userId: candidateId,
        kind: 'wish_request_matched',
        blessingId: null,
        requestId: request.id,
        fromUserId: request.authorId,
        createdAt: now,
        readAt: null,
      });
    }
    return candidateIds;
  }

  return {
    async publish(userId: string, input: SubmitWishRequestInput): Promise<Result<WishRequestSummary>> {
      const user = await deps.repos.users.findById(userId);
      if (!user) return err(appError('unauthorized', 'no session', '请先登录'));

      const consent = await deps.repos.consents.latestForVersion(userId, AGREEMENT_VERSION);
      if (!consent) {
        return err(appError('consent_required', 'no consent', '请先同意《用户内容与授权协议》'));
      }

      const len = charCount(input.situationText);
      if (len < deps.config.bodyMinLen) {
        return err(
          appError(
            'validation_failed',
            'situation too short',
            `再多写一点吧（至少 ${String(deps.config.bodyMinLen)} 字）`,
          ),
        );
      }
      if (len > deps.config.bodyMaxLen) {
        return err(
          appError(
            'validation_failed',
            'situation too long',
            `有点长了，精简到 ${String(deps.config.bodyMaxLen)} 字以内`,
          ),
        );
      }

      const moderation = await deps.moderation.check({ text: input.situationText });
      const outcome = outcomeFor(moderation);
      if (outcome.trigger === 'auto_violation') {
        return err(
          appError(
            'validation_failed',
            `moderation violation: ${moderation.categories.join(',')}`,
            '这段内容没有通过审核，改一下再试试',
          ),
        );
      }

      const now = deps.clock.now().toISOString();
      // 广场未登录也能看，曝光面比群发的收件箱更大——命中疑似不能跳过人工复核，
      // 即使 WishRequest 没有 blessing 那套 hold/verifying 语义（见 types.ts 的注释）。
      const needsReview = outcome.createTicket;
      const record: WishRequestRecord = {
        id: deps.ids.next('wrq'),
        authorId: userId,
        situationText: input.situationText.trim(),
        scriptText: input.scriptText?.trim() || null,
        tags: input.tags,
        state: needsReview ? 'pending_review' : 'published',
        createdAt: now,
        recipientCandidateIds: [],
        moderation,
        responseCount: 0,
        lastResponseAt: null,
        anonymous: input.anonymous ?? false,
        lastResponseExcerpt: null,
      };

      // 先落库再匹配推送——matchAndNotify() 会写 notifications.request_id 外键指回
      // 这条祈福，PGlite 开着真实外键约束时，记录还没插入就先写引用会直接 23503
      // 报错（B-92：内存仓储没有外键约束，从没测出来，只在真的 pglite 下才炸）。
      await deps.repos.wishRequests.add(record);

      if (!needsReview) {
        record.recipientCandidateIds = await matchAndNotify(record);
        await deps.repos.wishRequests.save(record);
      }

      if (needsReview) {
        await deps.repos.reports.add({
          id: deps.ids.next('rpt'),
          blessingId: null,
          requestId: record.id,
          origin: 'auto_suspect',
          category: moderation.categories[0] ?? 'other',
          state: 'open',
          priority: 30,
          note: outcome.note,
          assignee: null,
          resolutionReason: null,
          reporterFingerprint: null,
          count: 1,
          createdAt: now,
          resolvedAt: null,
          timeline: [{ at: now, text: '工单创建（auto_suspect，来自祝福请求）' }],
        });
      }

      return ok(await toSummary(record, userId));
    },

    /** 人工复核通过一条待审的祈福：正式公开，并这时才触发匹配推送
     * （之前一直没公开，不该在还没过审时就把它推给别人）。 */
    async approveAfterReview(id: string): Promise<Result<null>> {
      const r = await deps.repos.wishRequests.findById(id);
      if (!r) return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      const result = applyWishRequestTrigger(r.state, 'review_pass');
      if (!result.ok) {
        return err(appError('blessing_state_conflict', result.reason, '这个操作现在做不了'));
      }
      const candidateIds = await matchAndNotify(r);
      await deps.repos.wishRequests.save({
        ...r,
        state: result.next,
        recipientCandidateIds: candidateIds,
      });
      return ok(null);
    },

    /** 人工复核驳回一条待审的祈福：直接进终态，不公开。 */
    async rejectAfterReview(id: string): Promise<Result<null>> {
      const r = await deps.repos.wishRequests.findById(id);
      if (!r) return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      const result = applyWishRequestTrigger(r.state, 'review_reject');
      if (!result.ok) {
        return err(appError('blessing_state_conflict', result.reason, '这个操作现在做不了'));
      }
      await deps.repos.wishRequests.save({ ...r, state: result.next });
      return ok(null);
    },

    /** 祈福广场：filter='mine' 只列自己的（含 pending_review / withdrawn）；否则只列 published。 */
    async plaza(
      viewerId: string | null,
      filter: 'all' | 'mine',
    ): Promise<Result<WishRequestSummary[]>> {
      if (filter === 'mine') {
        if (!viewerId) return err(appError('unauthorized', 'no session', '请先登录'));
        const list = await deps.repos.wishRequests.listByAuthor(viewerId);
        return ok(await Promise.all(list.map((r) => toSummary(r, viewerId))));
      }
      const list = await deps.repos.wishRequests.listPublished();
      return ok(await Promise.all(list.map((r) => toSummary(r, viewerId))));
    },

    /** 祈福详情：处境全文 + 稿子 + 全部 published 回应（无评分细节）。任何登录用户可看。 */
    async detail(id: string, viewerId: string | null): Promise<WishRequestDetail | null> {
      const r = await deps.repos.wishRequests.findById(id);
      if (!r) return null;
      // 未公开的祈福：只有作者本人能看（用于"我的祈福"里点进 pending_review / withdrawn 的那条）
      if (r.state !== 'published' && r.authorId !== viewerId) return null;

      const a = await authorInfo(r.authorId, r.anonymous);
      const blessings = await deps.repos.blessings.listByRequestId(id);
      const responses: ResponseView[] = [];
      for (const b of blessings) {
        if (b.state !== 'published') continue; // 未过审 / 已撤回的不展示
        const [sender, senderProfile] = await Promise.all([
          deps.repos.users.findById(b.authorId),
          deps.repos.profiles.get(b.authorId),
        ]);
        const hasAudio = b.media !== null;
        responses.push({
          id: b.id,
          fromUserId: b.authorId,
          fromNickname: senderProfile?.senderName ?? sender?.nickname ?? '一位朋友',
          fromCity: senderProfile?.regionCity ?? null,
          // 未登录访客可读文字，但音频要登录——这里只负责不下发链接，路由层的 requireUserId()
          // 挡住真正的访问（见 audio-scoring-service.readAudio 的 design D2）。
          audioUrl: viewerId && hasAudio ? (b.media?.url ?? null) : null,
          audioLocked: !viewerId && hasAudio,
          transcript: b.media?.transcript ?? null,
          createdAt: b.publishedAt ?? b.createdAt,
          replies: await collectReplyChain(b.id),
        });
      }
      responses.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));

      return {
        id: r.id,
        authorId: r.authorId,
        authorNickname: a.nickname,
        authorCity: a.city,
        situationText: r.situationText,
        scriptText: r.scriptText,
        tags: r.tags,
        responseCount: r.responseCount,
        lastResponseAt: r.lastResponseAt,
        state: r.state,
        createdAt: r.createdAt,
        isMine: viewerId !== null && r.authorId === viewerId,
        responses,
      };
    },

    async withdraw(userId: string, id: string): Promise<Result<null>> {
      const r = await deps.repos.wishRequests.findById(id);
      if (r?.authorId !== userId) {
        return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      }
      const result = applyWishRequestTrigger(r.state, 'withdraw');
      if (!result.ok) {
        return err(appError('blessing_state_conflict', result.reason, '这个操作现在做不了'));
      }
      await deps.repos.wishRequests.save({ ...r, state: result.next });
      return ok(null);
    },

    async remove(userId: string, id: string): Promise<Result<null>> {
      const r = await deps.repos.wishRequests.findById(id);
      if (r?.authorId !== userId) {
        return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      }
      const result = applyWishRequestTrigger(r.state, 'delete');
      if (!result.ok) {
        return err(appError('blessing_state_conflict', result.reason, '这个操作现在做不了'));
      }
      await deps.repos.wishRequests.save({ ...r, state: result.next });
      return ok(null);
    },
  };
}

export type WishRequestService = ReturnType<typeof createWishRequestService>;
