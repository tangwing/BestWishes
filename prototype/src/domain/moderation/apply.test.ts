import { describe, it, expect } from 'vitest';
import { outcomeFor, isSpotChecked } from './apply';
import type { ModerationResult } from '../types';

const r = (over: Partial<ModerationResult>): ModerationResult => ({
  verdict: 'pass',
  categories: [],
  ...over,
});

describe('outcomeFor — 结论驱动状态机', () => {
  it('pass → auto_pass，不建工单', () => {
    expect(outcomeFor(r({ verdict: 'pass' }))).toMatchObject({
      trigger: 'auto_pass',
      createTicket: false,
    });
  });

  it('violation → auto_violation，不建工单', () => {
    expect(outcomeFor(r({ verdict: 'violation' }))).toMatchObject({
      trigger: 'auto_violation',
      createTicket: false,
    });
  });

  it('suspect → 保持 verifying + 建工单', () => {
    expect(outcomeFor(r({ verdict: 'suspect' }))).toMatchObject({
      trigger: null,
      createTicket: true,
      ticketOrigin: 'auto_suspect',
    });
  });

  it('unavailable → 保守：保持 verifying + 建工单（即便 verdict 名义是 suspect）', () => {
    expect(outcomeFor(r({ verdict: 'suspect', unavailable: true }))).toMatchObject({
      trigger: null,
      createTicket: true,
    });
  });
});

describe('isSpotChecked — 抽检确定性', () => {
  it('ratio=0 从不命中', () => {
    expect(isSpotChecked(0, 0)).toBe(false);
  });
  it('roll < ratio 命中', () => {
    expect(isSpotChecked(0.05, 0.01)).toBe(true);
    expect(isSpotChecked(0.05, 0.5)).toBe(false);
  });
});
