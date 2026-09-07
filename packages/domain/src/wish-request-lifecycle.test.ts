import { describe, it, expect } from 'vitest';
import {
  applyWishRequestTrigger,
  canApplyWishRequestTrigger,
  allowedWishRequestTriggers,
} from './wish-request-lifecycle';

describe('祝福请求状态机 — 疑似内容要过人工复核', () => {
  it('pending_review --review_pass--> published', () => {
    const r = applyWishRequestTrigger('pending_review', 'review_pass');
    expect(r).toEqual({ ok: true, next: 'published' });
  });

  it('pending_review --review_reject--> deleted', () => {
    const r = applyWishRequestTrigger('pending_review', 'review_reject');
    expect(r).toEqual({ ok: true, next: 'deleted' });
  });

  it('pending_review 不接受 withdraw（还没公开，没什么可撤回的）', () => {
    expect(canApplyWishRequestTrigger('pending_review', 'withdraw')).toBe(false);
  });
});

describe('祝福请求状态机 — 合法转移', () => {
  it('published --withdraw--> withdrawn', () => {
    const r = applyWishRequestTrigger('published', 'withdraw');
    expect(r).toEqual({ ok: true, next: 'withdrawn' });
  });

  it('published --delete--> deleted', () => {
    const r = applyWishRequestTrigger('published', 'delete');
    expect(r).toEqual({ ok: true, next: 'deleted' });
  });

  it('withdrawn --delete--> deleted', () => {
    const r = applyWishRequestTrigger('withdrawn', 'delete');
    expect(r).toEqual({ ok: true, next: 'deleted' });
  });
});

describe('祝福请求状态机 — 撤回是终态，没有重新发布', () => {
  it('withdrawn 只剩 delete 一条出边', () => {
    expect(allowedWishRequestTriggers('withdrawn')).toEqual(['delete']);
  });

  it('withdrawn 不接受 withdraw（不能重复撤回）', () => {
    expect(canApplyWishRequestTrigger('withdrawn', 'withdraw')).toBe(false);
  });
});

describe('祝福请求状态机 — deleted 是终态', () => {
  it('deleted 没有任何出边', () => {
    expect(allowedWishRequestTriggers('deleted')).toEqual([]);
  });

  it('deleted 不接受任何触发', () => {
    const r = applyWishRequestTrigger('deleted', 'delete');
    expect(r.ok).toBe(false);
  });
});
