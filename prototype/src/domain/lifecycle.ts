// 祝福状态机（纯函数）。对应 specs/blessing-delivery「祝福状态机」。
// 转移表来自 docs/architecture/p1-architecture.md §3。

import type { BlessingState, LifecycleTrigger } from './types';

type TransitionTable = {
  [S in BlessingState]: Partial<Record<LifecycleTrigger, BlessingState>>;
};

const TRANSITIONS: TransitionTable = {
  draft: {
    submit: 'verifying',
  },
  verifying: {
    auto_pass: 'published',
    review_pass: 'published',
    auto_violation: 'rejected',
    review_reject: 'rejected',
    withdraw: 'withdrawn', // 作者在校验期取消
  },
  published: {
    review_takedown: 'taken_down',
    report_takedown: 'taken_down',
    withdraw: 'withdrawn',
    expire: 'expired',
    delete: 'deleted',
  },
  rejected: {
    edit_resubmit: 'verifying',
    delete: 'deleted',
  },
  taken_down: {
    appeal_success: 'published',
    delete: 'deleted',
  },
  withdrawn: {
    republish: 'verifying',
    delete: 'deleted',
  },
  expired: {
    renew: 'published',
    delete: 'deleted',
  },
  deleted: {
    // 终态：无出边
  },
};

export type ApplyResult =
  | { ok: true; next: BlessingState }
  | { ok: false; reason: string };

/** 只判定转移是否合法并给出目标状态；不做 IO、不改对象。 */
export function applyTrigger(
  state: BlessingState,
  trigger: LifecycleTrigger,
): ApplyResult {
  const next = TRANSITIONS[state][trigger];
  if (next === undefined) {
    return {
      ok: false,
      reason: `非法转移：状态 "${state}" 不接受触发 "${trigger}"`,
    };
  }
  return { ok: true, next };
}

export function canApply(state: BlessingState, trigger: LifecycleTrigger): boolean {
  return TRANSITIONS[state][trigger] !== undefined;
}

export function allowedTriggers(state: BlessingState): LifecycleTrigger[] {
  return Object.keys(TRANSITIONS[state]) as LifecycleTrigger[];
}

export const TERMINAL_STATES: readonly BlessingState[] = ['deleted'];

export function isTerminal(state: BlessingState): boolean {
  return TERMINAL_STATES.includes(state);
}
