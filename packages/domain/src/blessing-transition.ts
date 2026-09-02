// 一次祝福状态转移的全部纯逻辑：算出新状态、要追加的事件、以及对坚持记录的增减。
// 不做 IO；时间和有效期天数由调用方传进来。application 层负责持久化和把 streakDelta 落到 streak 仓储。

import { applyTrigger } from './lifecycle';
import type { Blessing, BlessingEvent, LifecycleActor, LifecycleTrigger } from './types';

export type TransitionResult =
  | {
      ok: true;
      blessing: Blessing;
      event: BlessingEvent;
      /** 对作者当日发布计数的增减：+1 首次发布 / -1 作者收回或平台下架 / 0 其它 */
      streakDelta: 1 | 0 | -1;
    }
  | { ok: false; reason: string };

export interface TransitionContext {
  at: string; // ISO
  linkTtlDays: number;
}

export function applyBlessingTransition(
  blessing: Blessing,
  trigger: LifecycleTrigger,
  actor: LifecycleActor,
  reason: string | undefined,
  ctx: TransitionContext,
): TransitionResult {
  const res = applyTrigger(blessing.state, trigger);
  if (!res.ok) return { ok: false, reason: res.reason };

  const from = blessing.state;
  const to = res.next;
  const event: BlessingEvent =
    reason === undefined
      ? { from, to, trigger, actor, at: ctx.at }
      : { from, to, trigger, actor, reason, at: ctx.at };

  const next: Blessing = { ...blessing, state: to, events: [...blessing.events, event] };
  let streakDelta: 1 | 0 | -1 = 0;

  const ttlMs = ctx.linkTtlDays * 86_400_000;

  if (to === 'published' && from !== 'expired') {
    // 首次发布（或撤回后重新发布、申诉恢复）
    next.publishedAt = ctx.at;
    next.expiresAt = new Date(new Date(ctx.at).getTime() + ttlMs).toISOString();
    if (!blessing.countedInStreak) {
      next.countedInStreak = true;
      streakDelta = 1;
    }
  } else if (to === 'published' && from === 'expired') {
    // 续期：顺延有效期，不动坚持记录
    next.expiresAt = new Date(new Date(ctx.at).getTime() + ttlMs).toISOString();
    next.renewCount = blessing.renewCount + 1;
  } else if (
    blessing.countedInStreak &&
    (to === 'withdrawn' || to === 'deleted' || to === 'taken_down')
  ) {
    // 作者收回 / 平台下架 → 回撤计数（链接过期不走这里）
    next.countedInStreak = false;
    streakDelta = -1;
  }

  return { ok: true, blessing: next, event, streakDelta };
}
