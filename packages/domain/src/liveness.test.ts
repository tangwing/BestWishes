import { describe, it, expect } from 'vitest';
import { transcriptContainsPhrase } from './liveness';

describe('transcriptContainsPhrase', () => {
  it('转写文本包含验证词时通过', () => {
    expect(transcriptContainsPhrase('请听好，372，愿你平安喜乐', '372')).toBe(true);
  });

  it('转写文本不包含验证词时不通过', () => {
    expect(transcriptContainsPhrase('愿你平安喜乐每一天', '372')).toBe(false);
  });
});
