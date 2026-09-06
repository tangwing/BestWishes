import { describe, it, expect } from 'vitest';
import { RuleBasedAsrProvider } from './rule-based-asr';

describe('RuleBasedAsrProvider', () => {
  it('没有 clientTranscript 时返回空转写、静音铺满全程、置信度 0', async () => {
    const provider = new RuleBasedAsrProvider();
    const r = await provider.transcribe(Buffer.from([]), 12);
    expect(r.text).toBe('');
    expect(r.confidence).toBe(0);
    expect(r.silenceSegmentsSec).toEqual([12]);
  });

  it('有 clientTranscript 时采信为转写文本，词时间戳按时长均匀铺开', async () => {
    const provider = new RuleBasedAsrProvider();
    const r = await provider.transcribe(Buffer.from([]), 10, { clientTranscript: '愿你平安' });
    expect(r.text).toBe('愿你平安');
    expect(r.wordTimestamps).toHaveLength(4);
    expect(r.wordTimestamps[0]?.[0]).toBe(0);
    expect(r.wordTimestamps.at(-1)?.[1]).toBe(10);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('durationSec 为 0 时不产生虚假的静音段', async () => {
    const provider = new RuleBasedAsrProvider();
    const r = await provider.transcribe(Buffer.from([]), 0);
    expect(r.silenceSegmentsSec).toEqual([]);
  });
});
