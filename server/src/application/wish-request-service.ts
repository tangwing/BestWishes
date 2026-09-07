// 祝福请求：撰写、发布（含内容安全检查 + 触发匹配推送）、生命周期（撤回是终态，
// 同 blessing-delivery 的教训，不提供重新发布）、广场浏览、查看收到的回应。

import { applyWishRequestTrigger, outcomeFor, type AudienceFilter } from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import { AGREEMENT_VERSION, type AppDeps } from './deps';
import { createAudienceService } from './audience-service';
import type { WishRequestRecord } from '../ports/records';

export interface SubmitWishRequestInput {
  situationText: string;
  scriptText?: string | undefined;
  tags: string[];
}

export interface WishRequestView {
  id: string;
  authorId: string;
  authorNickname: string;
  situationText: string;
  scriptText: string | null;
  tags: string[];
  state: string;
  createdAt: string;
}

export interface ResponseSummary {
  id: string;
  fromNickname: string;
  fromCity: string | null;
  audioUrl: string | null;
  createdAt: string;
}

function charCount(s: string): number {
  return Array.from(s.trim()).length;
}

export function createWishRequestService(deps: AppDeps) {
  const audience = createAudienceService(deps);

  async function toView(r: WishRequestRecord): Promise<WishRequestView> {
    const [user, profile] = await Promise.all([
      deps.repos.users.findById(r.authorId),
      deps.repos.profiles.get(r.authorId),
    ]);
    return {
      id: r.id,
      authorId: r.authorId,
      authorNickname: profile?.senderName ?? user?.nickname ?? '一位朋友',
      situationText: r.situationText,
      scriptText: r.scriptText,
      tags: r.tags,
      state: r.state,
      createdAt: r.createdAt,
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
    async publish(userId: string, input: SubmitWishRequestInput): Promise<Result<WishRequestView>> {
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
      };

      if (!needsReview) {
        record.recipientCandidateIds = await matchAndNotify(record);
      }
      await deps.repos.wishRequests.add(record);

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

      return ok(await toView(record));
    },

    /** 人工复核通过一条待审的请求：正式公开，并这时才触发匹配推送
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

    /** 人工复核驳回一条待审的请求：直接进终态，不公开。 */
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

    async plaza(): Promise<WishRequestView[]> {
      const list = await deps.repos.wishRequests.listPublished();
      return Promise.all(list.map(toView));
    },

    async getById(id: string): Promise<WishRequestView | null> {
      const r = await deps.repos.wishRequests.findById(id);
      if (!r) return null;
      return toView(r);
    },

    async myRequests(userId: string): Promise<WishRequestView[]> {
      const list = await deps.repos.wishRequests.listByAuthor(userId);
      return Promise.all(list.map(toView));
    },

    async withdraw(userId: string, id: string): Promise<Result<null>> {
      const r = await deps.repos.wishRequests.findById(id);
      if (!r || r.authorId !== userId) {
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
      if (!r || r.authorId !== userId) {
        return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      }
      const result = applyWishRequestTrigger(r.state, 'delete');
      if (!result.ok) {
        return err(appError('blessing_state_conflict', result.reason, '这个操作现在做不了'));
      }
      await deps.repos.wishRequests.save({ ...r, state: result.next });
      return ok(null);
    },

    /** 请求作者查看收到的全部回应，不设数量上限。 */
    async responses(userId: string, requestId: string): Promise<Result<ResponseSummary[]>> {
      const r = await deps.repos.wishRequests.findById(requestId);
      if (!r || r.authorId !== userId) {
        return err(appError('not_found', 'wish request not found', '找不到这条请求'));
      }
      const blessings = await deps.repos.blessings.listByRequestId(requestId);
      const out: ResponseSummary[] = [];
      for (const b of blessings) {
        if (b.state !== 'published') continue; // 未过审 / 已撤回的不展示给请求人
        const [sender, senderProfile] = await Promise.all([
          deps.repos.users.findById(b.authorId),
          deps.repos.profiles.get(b.authorId),
        ]);
        out.push({
          id: b.id,
          fromNickname: senderProfile?.senderName ?? sender?.nickname ?? '一位朋友',
          fromCity: senderProfile?.regionCity ?? null,
          audioUrl: b.media?.url ?? null,
          createdAt: b.publishedAt ?? b.createdAt,
        });
      }
      return ok(out);
    },
  };
}

export type WishRequestService = ReturnType<typeof createWishRequestService>;
