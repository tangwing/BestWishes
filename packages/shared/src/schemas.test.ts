import { describe, it, expect } from 'vitest';
import { DEFAULT_AUDIENCE_FILTER, submitWishRequestSchema } from './schemas';

describe('DEFAULT_AUDIENCE_FILTER', () => {
  it('年龄 / 性别 / 标签均为空——防止后人"顺手加个默认标签"把冷启动用户命中数打成 0', () => {
    expect(DEFAULT_AUDIENCE_FILTER.ageMin).toBeNull();
    expect(DEFAULT_AUDIENCE_FILTER.ageMax).toBeNull();
    expect(DEFAULT_AUDIENCE_FILTER.gender).toBe('any');
    expect(DEFAULT_AUDIENCE_FILTER.tags).toEqual([]);
    expect(DEFAULT_AUDIENCE_FILTER.radiusKm).toBeGreaterThan(0);
  });
});

describe('submitWishRequestSchema', () => {
  it('anonymous 可选，默认 false', () => {
    const parsed = submitWishRequestSchema.parse({ situationText: '一段处境描述', tags: [] });
    expect(parsed.anonymous).toBe(false);
  });

  it('可显式传 anonymous: true', () => {
    const parsed = submitWishRequestSchema.parse({
      situationText: '一段处境描述',
      tags: [],
      anonymous: true,
    });
    expect(parsed.anonymous).toBe(true);
  });
});
