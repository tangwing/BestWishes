import { describe, it, expect } from 'vitest';
import { seedTemplates, templateViolatesGuard, OCCASION_LABEL } from './seed';

describe('范本库 seed', () => {
  it('每个场景至少 3 条', () => {
    const tpls = seedTemplates();
    for (const occ of Object.keys(OCCASION_LABEL)) {
      const n = tpls.filter((t) => t.occasion === occ).length;
      expect(n, `${occ} 至少 3 条`).toBeGreaterThanOrEqual(3);
    }
  });

  it('所有范本 id 唯一', () => {
    const ids = seedTemplates().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('含"代祷收费"的范本会被护栏拒绝', () => {
    expect(templateViolatesGuard('欢迎付费代祷，愿你平安')).toBe(true);
    expect(templateViolatesGuard('愿你平安喜乐，一切都好')).toBe(false);
  });
});
