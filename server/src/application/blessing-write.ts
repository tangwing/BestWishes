// 一次祝福状态转移的落地：跑领域纯逻辑 → 存祝福 → 追加事件 → 把坚持记录的增减落到 streak 仓储。
// 所有会改祝福状态的用例都走这里，保证事件和坚持记录不漏。

import {
  applyBlessingTransition,
  localDateFor,
  recordPublish,
  recordUnpublish,
  type LifecycleActor,
  type LifecycleTrigger,
} from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import type { BlessingRecord } from '../ports/records';

export async function transitionAndPersist(
  deps: AppDeps,
  blessing: BlessingRecord,
  trigger: LifecycleTrigger,
  actor: LifecycleActor,
  reason: string | undefined,
  holdUntil: string | null = blessing.holdUntil,
): Promise<Result<BlessingRecord>> {
  const now = deps.clock.now().toISOString();
  const r = applyBlessingTransition(blessing, trigger, actor, reason, {
    at: now,
    linkTtlDays: deps.config.linkTtlDays,
  });
  if (!r.ok) {
    return err(appError('blessing_state_conflict', r.reason, '这个操作现在做不了'));
  }

  const next: BlessingRecord = { ...r.blessing, holdUntil };
  await deps.repos.blessings.save(next);
  await deps.repos.blessingEvents.append({
    ...r.event,
    id: deps.ids.next('bev'),
    blessingId: blessing.id,
  });

  if (r.streakDelta !== 0) {
    const user = await deps.repos.users.findById(blessing.authorId);
    const offset = user?.utcOffsetMinutes ?? 480;
    // +1：用刚设的 publishedAt；-1：用原始 publishedAt（撤回 / 删除不改它）
    const at = next.publishedAt ?? now;
    const localDate = localDateFor(new Date(at), offset);
    const days = await deps.repos.streaks.getDays(blessing.authorId);
    await deps.repos.streaks.setDays(
      blessing.authorId,
      r.streakDelta > 0 ? recordPublish(days, localDate) : recordUnpublish(days, localDate),
    );
  }

  return ok(next);
}
