import { describe, it, expect } from 'vitest';
import { applyTrigger, canApply, allowedTriggers, isTerminal } from './lifecycle';
import type { BlessingState, LifecycleTrigger } from './types';

// 对应 specs/blessing-delivery「祝福状态机」的 scenario。

describe('祝福状态机 — 合法转移', () => {
  const legal: [BlessingState, LifecycleTrigger, BlessingState][] = [
    ['draft', 'submit', 'verifying'],
    ['verifying', 'auto_pass', 'published'],
    ['verifying', 'review_pass', 'published'],
    ['verifying', 'auto_violation', 'rejected'],
    ['verifying', 'review_reject', 'rejected'],
    ['verifying', 'withdraw', 'withdrawn'],
    ['published', 'withdraw', 'withdrawn'],
    ['published', 'expire', 'expired'],
    ['published', 'review_takedown', 'taken_down'],
    ['published', 'report_takedown', 'taken_down'],
    ['published', 'delete', 'deleted'],
    ['withdrawn', 'delete', 'deleted'],
    ['expired', 'renew', 'published'],
    ['expired', 'delete', 'deleted'],
    ['rejected', 'edit_resubmit', 'verifying'],
    ['rejected', 'delete', 'deleted'],
    ['taken_down', 'appeal_success', 'published'],
    ['taken_down', 'delete', 'deleted'],
  ];

  it.each(legal)('%s --%s--> %s', (from, trigger, to) => {
    const r = applyTrigger(from, trigger);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next).toBe(to);
  });
});

describe('祝福状态机 — 提交进入校验', () => {
  it('提交一份草稿 → verifying', () => {
    const r = applyTrigger('draft', 'submit');
    expect(r).toEqual({ ok: true, next: 'verifying' });
  });
});

describe('祝福状态机 — 非法转移被拒绝', () => {
  it('deleted 不能转为 published', () => {
    const r = applyTrigger('deleted', 'auto_pass');
    expect(r.ok).toBe(false);
  });

  it('deleted 是终态，没有任何出边', () => {
    expect(allowedTriggers('deleted')).toEqual([]);
    expect(isTerminal('deleted')).toBe(true);
  });

  it('draft 不能直接 published', () => {
    expect(canApply('draft', 'auto_pass')).toBe(false);
  });

  it('verifying 可被作者撤回（校验期取消）', () => {
    expect(canApply('verifying', 'withdraw')).toBe(true);
  });

  it('已过期祝福续期时不重新校验（直接回 published，不经 verifying）', () => {
    const r = applyTrigger('expired', 'renew');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next).toBe('published');
  });

  it('撤回后不允许重新发布 —— 撤回是终态（只能删除，或复制内容另发一条新的）', () => {
    expect(allowedTriggers('withdrawn')).toEqual(['delete']);
  });
});

describe('祝福状态机 — 每个非终态至少有一条出边', () => {
  const states: BlessingState[] = [
    'draft',
    'verifying',
    'published',
    'rejected',
    'taken_down',
    'withdrawn',
    'expired',
  ];
  it.each(states)('%s 有出边', (s) => {
    expect(allowedTriggers(s).length).toBeGreaterThan(0);
  });
});
