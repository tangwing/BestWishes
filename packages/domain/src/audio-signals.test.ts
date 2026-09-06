import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import {
  countLongPauses,
  speechRateVariance,
  fillerWordStats,
  scoreFocus,
} from './audio-signals';
import type { AudioSignals } from './types';

const cfg = DEFAULT_CONFIG.focusScoring;

describe('countLongPauses', () => {
  it('无停顿时为 0', () => {
    expect(countLongPauses([], 3)).toBe(0);
  });

  it('只数超过阈值的停顿', () => {
    expect(countLongPauses([1, 2, 3.5, 4, 5], 3)).toBe(3);
  });
});

describe('fillerWordStats', () => {
  it('空转写返回 0', () => {
    expect(fillerWordStats('')).toEqual({ count: 0, density: 0 });
  });

  it('数出犹豫词次数', () => {
    const r = fillerWordStats('嗯，这个，那个，我想说的是……呃');
    expect(r.count).toBe(4);
    expect(r.density).toBeGreaterThan(0);
  });

  it('没有犹豫词时密度为 0', () => {
    const r = fillerWordStats('愿你平安喜乐每一天');
    expect(r).toEqual({ count: 0, density: 0 });
  });
});

describe('speechRateVariance', () => {
  it('没有时间戳时为 0', () => {
    expect(speechRateVariance([])).toBe(0);
  });

  it('时长太短（不足两个窗口）时为 0', () => {
    expect(speechRateVariance([[0, 1, '你好']])).toBe(0);
  });

  it('语速均匀时方差较小', () => {
    // 6 秒，每 3 秒窗口说 3 个字，速率均匀
    const timestamps: [number, number, string][] = [
      [0, 1, '你'],
      [1, 2, '好'],
      [2, 3, '呀'],
      [3, 4, '愿'],
      [4, 5, '你'],
      [5, 6, '好'],
    ];
    expect(speechRateVariance(timestamps)).toBe(0);
  });

  it('忽快忽慢时方差明显大于 0', () => {
    const timestamps: [number, number, string][] = [
      [0, 0.5, '愿你被这个世界温柔以待啊'],
      [3, 3.9, '好'],
    ];
    expect(speechRateVariance(timestamps)).toBeGreaterThan(0);
  });
});

function baseSignals(over: Partial<AudioSignals> = {}): AudioSignals {
  return {
    durationSec: 30,
    silenceSegmentsSec: [0.5, 0.8, 1],
    wordTimestamps: [
      [0, 1, '愿'],
      [1, 2, '你'],
      [2, 3, '平'],
      [3, 4, '安'],
      [4, 5, '喜'],
      [5, 6, '乐'],
    ],
    transcript: '愿你平安喜乐，每一天都被这个世界温柔以待。',
    ...over,
  };
}

describe('scoreFocus — 综合判定', () => {
  it('停顿正常、语速平稳、无犹豫词 -> 高', () => {
    const r = scoreFocus(baseSignals(), cfg);
    expect(r.label).toBe('high');
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('大量异常长停顿 + 密集犹豫词 -> 低', () => {
    const r = scoreFocus(
      baseSignals({
        silenceSegmentsSec: [4, 5, 6, 7, 8],
        transcript: '嗯……这个……那个……呃……嗯……这个……',
      }),
      cfg,
    );
    expect(r.label).toBe('low');
  });

  it('返回的信号明细可用于解释判定依据', () => {
    const r = scoreFocus(baseSignals({ silenceSegmentsSec: [4, 5] }), cfg);
    expect(r.signals.longPauseCount).toBe(2);
    expect(r.signals.fillerWordCount).toBe(0);
  });
});
