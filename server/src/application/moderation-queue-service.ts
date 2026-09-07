import type { ReportCategory } from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import { transitionAndPersist } from './blessing-write';
import { createWishRequestService } from './wish-request-service';
import type { ReportRecord } from '../ports/records';

export interface QueueItem {
  id: string;
  origin: ReportRecord['origin'];
  category: ReportCategory;
  priority: number;
  count: number;
  note: string | null;
  createdAt: string;
  blessing: { id: string; state: string; body: string } | null;
  /** 工单来自祝福请求时非空——广场未登录也能看，命中疑似同样要过这个队列。 */
  wishRequest: { id: string; state: string; situationText: string } | null;
}

export type ResolveAction = 'pass' | 'takedown' | 'request_edit';

export function createModerationQueueService(deps: AppDeps) {
  const wishRequests = createWishRequestService(deps);

  return {
    async queue(): Promise<QueueItem[]> {
      const reports = await deps.repos.reports.listOpen();
      const items: QueueItem[] = [];
      for (const r of reports) {
        const b = r.blessingId ? await deps.repos.blessings.findById(r.blessingId) : null;
        const wr = r.requestId ? await deps.repos.wishRequests.findById(r.requestId) : null;
        items.push({
          id: r.id,
          origin: r.origin,
          category: r.category,
          priority: r.priority,
          count: r.count,
          note: r.note,
          createdAt: r.createdAt,
          blessing: b ? { id: b.id, state: b.state, body: b.body } : null,
          wishRequest: wr ? { id: wr.id, state: wr.state, situationText: wr.situationText } : null,
        });
      }
      return items;
    },

    async resolve(
      reportId: string,
      action: ResolveAction,
      reason: string,
      moderatorId: string,
    ): Promise<Result<null>> {
      const r = await deps.repos.reports.findById(reportId);
      if (!r) return err(appError('not_found', 'report not found', '工单不存在'));

      const b = r.blessingId ? await deps.repos.blessings.findById(r.blessingId) : null;
      const actor = { kind: 'moderator', userId: moderatorId } as const;

      if (r.requestId) {
        // 来自祝福请求的工单：pass → 正式公开（这时才触发匹配推送）；
        // takedown / request_edit 都视为驳回，直接进终态——请求没有"改了重投"的流程，
        // 作者要改内容只能撤回/删除后重新发一条。
        if (action === 'pass') {
          await wishRequests.approveAfterReview(r.requestId);
        } else {
          await wishRequests.rejectAfterReview(r.requestId);
        }
      } else if (b) {
        const cleared = { ...b, holdUntil: null };
        if (action === 'pass') {
          if (b.state === 'verifying') {
            await transitionAndPersist(deps, cleared, 'review_pass', actor, reason);
          } else if (b.state === 'taken_down') {
            await transitionAndPersist(deps, cleared, 'appeal_success', actor, reason);
          }
        } else if (action === 'takedown') {
          if (b.state === 'published') {
            await transitionAndPersist(deps, cleared, 'review_takedown', actor, reason);
          } else if (b.state === 'verifying') {
            await transitionAndPersist(deps, cleared, 'review_reject', actor, reason);
          }
        } else if (b.state === 'verifying') {
          await transitionAndPersist(deps, cleared, 'review_reject', actor, reason);
        }
      }

      const now = deps.clock.now().toISOString();
      const nextState =
        action === 'pass'
          ? 'resolved_pass'
          : action === 'takedown'
            ? 'resolved_takedown'
            : 'resolved_edit';
      await deps.repos.reports.save({
        ...r,
        state: nextState,
        assignee: moderatorId,
        resolutionReason: reason,
        resolvedAt: now,
        timeline: [...r.timeline, { at: now, text: `审核员处理：${action} — ${reason}` }],
      });
      return ok(null);
    },
  };
}

export type ModerationQueueService = ReturnType<typeof createModerationQueueService>;
