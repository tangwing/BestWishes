import { describe, it, expect } from 'vitest';
import {
  scoreScriptCoverage,
  scoreFreeformCompleteness,
  scoreCompleteness,
} from './script-coverage';

describe('scoreScriptCoverage — 有稿子时按覆盖率判定', () => {
  it('完整念完稿子 -> complete', () => {
    const script = '愿你平安喜乐，事事顺遂。';
    const transcript = '愿你平安喜乐，事事顺遂，我是真心这样想的。';
    const r = scoreScriptCoverage(script, transcript);
    expect(r.label).toBe('complete');
    expect(r.coverage).toBeGreaterThanOrEqual(0.8);
  });

  it('只念了一半 -> partial 或 incomplete', () => {
    const script = '愿你平安喜乐，事事顺遂，家庭美满，工作顺利。';
    const transcript = '愿你平安喜乐。';
    const r = scoreScriptCoverage(script, transcript);
    expect(r.label).not.toBe('complete');
  });

  it('完全没念稿子内容 -> incomplete', () => {
    const script = '愿你平安喜乐，事事顺遂。';
    const transcript = '嗯……我不知道说什么好。';
    const r = scoreScriptCoverage(script, transcript);
    expect(r.label).toBe('incomplete');
  });
});

describe('scoreFreeformCompleteness — 无稿子时只判有效表达', () => {
  it('正常自由表达 -> complete', () => {
    expect(scoreFreeformCompleteness('愿你今天也能被这个世界温柔以待。')).toBe('complete');
  });

  it('空白 -> incomplete', () => {
    expect(scoreFreeformCompleteness('   ')).toBe('incomplete');
  });

  it('刷屏 -> incomplete', () => {
    expect(scoreFreeformCompleteness('啊啊啊啊啊啊啊啊啊啊啊啊')).toBe('incomplete');
  });
});

describe('scoreCompleteness — 统一入口', () => {
  it('有稿子走覆盖率判定', () => {
    expect(scoreCompleteness('愿你平安', '愿你平安喜乐')).toBe('complete');
  });

  it('无稿子走自由表达判定', () => {
    expect(scoreCompleteness(null, '愿你被这个世界温柔以待')).toBe('complete');
  });

  it('稿子为空字符串时按无稿子处理', () => {
    expect(scoreCompleteness('', '愿你被这个世界温柔以待')).toBe('complete');
  });
});
