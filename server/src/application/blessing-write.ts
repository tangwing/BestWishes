// 一次祝福状态转移的落地：跑领域纯逻辑 → 存祝福 → 追加事件 → 落坚持记录的增减 → 到点扇出投递。
// 所有会改祝福状态的用例都走这里，保证事件、坚持记录、收件箱投递都不漏。

import {
  applyBlessingTransition,
  type LifecycleActor,
  type LifecycleTrigger,
} from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import type { BlessingRecord } from '../ports/records';

/**
 * 一条祈福回应（scope='wish_response'）进入 / 离开 published 时，
 * 增量维护它所属祈福（Topic）的聚合统计——不在广场列表渲染时扫 blessings。
 * 见 wish-request spec「回应数聚合统计」。
 */
async function maintainWishRequestCounter(
  deps: AppDeps,
  before: BlessingRecord,
  after: BlessingRecord,
  now: string,
): Promise<void> {
  if (after.scope !== 'wish_response' || !after.requestId) return;
  const enteredPublished = before.state !== 'published' && after.state === 'published';
  const leftPublished = before.state === 'published' && after.state !== 'published';
  if (!enteredPublished && !leftPublished) return;

  const req = await deps.repos.wishRequests.findById(after.requestId);
  if (!req) return;
  await deps.repos.wishRequests.save({
    ...req,
    responseCount: Math.max(0, req.responseCount + (enteredPublished ? 1 : -1)),
    // lastResponseAt 单调：只在有新回应发布时前移，回应下架不回拨
    lastResponseAt: enteredPublished ? now : req.lastResponseAt,
  });
}

/**
 * 祝福首次进入 published 时，把它扇出到每个收件人的收件箱 + 发通知。
 * deliveredAt 作幂等标记：申诉恢复（taken_down→published）不会重复投递。
 */
async function deliverIfNeeded(deps: AppDeps, blessing: BlessingRecord): Promise<BlessingRecord> {
  if (blessing.state !== 'published' || blessing.deliveredAt !== null) return blessing;
  const at = deps.clock.now().toISOString();
  for (const recipientId of blessing.recipientIds) {
    await deps.repos.inbox.add({
      id: deps.ids.next('ibx'),
      recipientId,
      senderId: blessing.authorId,
      blessingId: blessing.id,
      deliveredAt: at,
      readAt: null,
    });
    await deps.repos.notifications.add({
      id: deps.ids.next('ntf'),
      userId: recipientId,
      kind: 'blessing_received',
      blessingId: blessing.id,
      requestId: null,
      fromUserId: blessing.authorId,
      createdAt: at,
      readAt: null,
    });
  }
  const delivered: BlessingRecord = { ...blessing, deliveredAt: at };
  await deps.repos.blessings.save(delivered);
  return delivered;
}

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

  let next: BlessingRecord = { ...r.blessing, holdUntil };
  await deps.repos.blessings.save(next);
  await deps.repos.blessingEvents.append({
    ...r.event,
    id: deps.ids.next('bev'),
    blessingId: blessing.id,
  });

  await maintainWishRequestCounter(deps, blessing, next, now);

  next = await deliverIfNeeded(deps, next);
  return ok(next);
}
