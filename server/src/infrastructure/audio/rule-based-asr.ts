// P2 默认的 ASR 实现：不接真实云语音识别，采信客户端提供的转写提示
// （见 AsrHint 的信任边界说明），把词时间戳按时长均匀铺开做近似估计
// （不是真实的强制对齐，只为让语速稳定性等信号有数据可算）。
// 目的是让整条打分管线在没有云账号的情况下可跑通、可测试、可 demo，
// 接口契约和未来接真实云 API 完全一致（design.md「打分管线」选型建议）。

import type { AsrHint, AsrProvider, AsrTranscript } from '../../ports/asr';

export class RuleBasedAsrProvider implements AsrProvider {
  readonly name = 'rule-based-asr';

  transcribe(_audio: Buffer, durationSec: number, hint?: AsrHint): Promise<AsrTranscript> {
    const text = hint?.clientTranscript?.trim() ?? '';
    if (text.length === 0) {
      return Promise.resolve({
        text: '',
        wordTimestamps: [],
        silenceSegmentsSec: durationSec > 0 ? [durationSec] : [],
        confidence: 0,
      });
    }

    const chars = Array.from(text);
    const wordTimestamps: [number, number, string][] = chars.map((c, i) => {
      const start = (i / chars.length) * durationSec;
      const end = ((i + 1) / chars.length) * durationSec;
      return [start, end, c];
    });

    return Promise.resolve({
      text,
      wordTimestamps,
      // 没有真实的静音检测（需要解码音频波形），近似估计为无异常停顿；
      // 真实云 ASR 接入后这里会是真实的静音段时长。
      silenceSegmentsSec: [],
      confidence: 0.5,
    });
  }
}
