// 语音转写。可插拔，同 ModerationProvider 的哲学：P2 默认接不需要真实云账号的
// 规则实现，真实云 API（阿里云 / 腾讯云）接入时只换实现，不改调用方契约。
// 见 add-p2-wish-request-audio design.md「打分管线」一节的选型建议。

export interface AsrTranscript {
  text: string;
  /** [开始秒, 结束秒, 文字] 三元组，供语速稳定性等信号计算使用。 */
  wordTimestamps: [number, number, string][];
  /** 静音段时长列表（秒）。 */
  silenceSegmentsSec: number[];
  confidence: number;
}

export interface AsrHint {
  /** 客户端侧识别出的文本（如浏览器 Web Speech API 实时转写）。
   * P2 的 RuleBased 实现会采信它作为转写结果——这是一个已知的信任边界：
   * 恶意客户端理论上可以提交跟音频无关的文本。真实云 ASR 接入后，
   * 服务端会重新对音频本身做转写，不再采信这个字段，届时这条信任边界自然消失。
   * 见 design.md 的风险登记。 */
  clientTranscript?: string | undefined;
}

export interface AsrProvider {
  readonly name: string;
  transcribe(audio: Buffer, durationSec: number, hint?: AsrHint): Promise<AsrTranscript>;
}
