// 祝福请求状态机（纯函数）。比 Blessing 的状态机简单得多——
// 请求没有"发布即校验、延迟送达"的语义，只有"公开 / 撤回 / 删除"三态，
// 撤回是终态、不提供重新发布（同 blessing-delivery 的"撤回是终态"教训，B-63）。

import type { WishRequestState, WishRequestTrigger } from './types';

type TransitionTable = Record<WishRequestState, Partial<Record<WishRequestTrigger, WishRequestState>>>;

const TRANSITIONS: TransitionTable = {
  pending_review: {
    review_pass: 'published',
    review_reject: 'deleted',
  },
  published: {
    withdraw: 'withdrawn',
    delete: 'deleted',
  },
  withdrawn: {
    delete: 'deleted',
  },
  deleted: {
    // 终态：无出边
  },
};

export type WishRequestApplyResult =
  | { ok: true; next: WishRequestState }
  | { ok: false; reason: string };

export function applyWishRequestTrigger(
  state: WishRequestState,
  trigger: WishRequestTrigger,
): WishRequestApplyResult {
  const next = TRANSITIONS[state][trigger];
  if (next === undefined) {
    return { ok: false, reason: `非法转移：请求状态 "${state}" 不接受触发 "${trigger}"` };
  }
  return { ok: true, next };
}

export function canApplyWishRequestTrigger(
  state: WishRequestState,
  trigger: WishRequestTrigger,
): boolean {
  return TRANSITIONS[state][trigger] !== undefined;
}

export function allowedWishRequestTriggers(state: WishRequestState): WishRequestTrigger[] {
  return Object.keys(TRANSITIONS[state]) as WishRequestTrigger[];
}
