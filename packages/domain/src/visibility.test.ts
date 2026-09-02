import { describe, it, expect } from 'vitest';
import { isPubliclyVisible, placeholderType } from './visibility';

const now = new Date('2026-09-02T12:00:00Z');
const future = new Date('2026-12-01T00:00:00Z');
const past = new Date('2026-08-01T00:00:00Z');

describe('isPubliclyVisible', () => {
  it('published 且未过期 → 可见', () => {
    expect(isPubliclyVisible('published', future, now)).toBe(true);
  });

  it('published 且无有效期 → 可见', () => {
    expect(isPubliclyVisible('published', null, now)).toBe(true);
  });

  it('published 但已过期 → 不可见', () => {
    expect(isPubliclyVisible('published', past, now)).toBe(false);
  });

  it.each([
    'verifying',
    'rejected',
    'taken_down',
    'withdrawn',
    'deleted',
    'expired',
    'draft',
  ] as const)('%s → 不可见', (s) => {
    expect(isPubliclyVisible(s, future, now)).toBe(false);
  });
});

describe('placeholderType — 校验期访客访问不返回正文', () => {
  it('verifying → preparing', () => {
    expect(placeholderType('verifying', null, now)).toBe('preparing');
  });

  it('published 未过期 → content', () => {
    expect(placeholderType('published', future, now)).toBe('content');
  });

  it('published 已过期 → expired（cron 未跑也不漏）', () => {
    expect(placeholderType('published', past, now)).toBe('expired');
  });

  it('withdrawn / deleted → 已被收回', () => {
    expect(placeholderType('withdrawn', null, now)).toBe('withdrawn');
    expect(placeholderType('deleted', null, now)).toBe('withdrawn');
  });

  it('rejected / taken_down → 中性占位', () => {
    expect(placeholderType('rejected', null, now)).toBe('taken_down');
    expect(placeholderType('taken_down', null, now)).toBe('taken_down');
  });

  it('expired → expired', () => {
    expect(placeholderType('expired', past, now)).toBe('expired');
  });
});
