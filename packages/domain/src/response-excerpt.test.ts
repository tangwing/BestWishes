import { describe, it, expect } from 'vitest';
import { truncateResponseExcerpt, RESPONSE_EXCERPT_MAX_CHARS } from './response-excerpt';

describe('truncateResponseExcerpt — 广场列表最新回应摘录截断', () => {
  it('短文本原样返回', () => {
    expect(truncateResponseExcerpt('愿你平安喜乐')).toBe('愿你平安喜乐');
  });

  it('超长文本截断并加省略号', () => {
    const long = '好'.repeat(RESPONSE_EXCERPT_MAX_CHARS + 10);
    const r = truncateResponseExcerpt(long);
    expect(r).not.toBeNull();
    expect(Array.from(r ?? '').length).toBe(RESPONSE_EXCERPT_MAX_CHARS + 1); // +1 是省略号
    expect(r?.endsWith('…')).toBe(true);
  });

  it('空串返回 null', () => {
    expect(truncateResponseExcerpt('')).toBeNull();
  });

  it('纯空白返回 null', () => {
    expect(truncateResponseExcerpt('   \n\t  ')).toBeNull();
  });

  it('音频无转写（null）返回 null', () => {
    expect(truncateResponseExcerpt(null)).toBeNull();
  });

  it('两端空白被裁剪', () => {
    expect(truncateResponseExcerpt('  你好呀  ')).toBe('你好呀');
  });
});
