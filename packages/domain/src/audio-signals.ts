// 音频"专注度"打分的信号工程（纯函数，不调用任何模型/网络）。
// 可解释优先：停顿分布 + 语速稳定性 + 犹豫词密度，加权组合成一个内部综合分，
// 只对外暴露 高/中/低 三档标签，不暴露具体分数（多维标签而非单一分数，见 design.md）。

import type { AudioSignals, ScoreLabel } from './types';
import type { FocusScoringConfig } from './config';

/** "嗯/呃" 本身极少是正常语句的一部分，出现即算犹豫词。
 * "这个/那个" 在中文里也常规地做指示代词用（"这个世界"），
 * 只有紧跟停顿标记（逗号/省略号/句末/另一个犹豫词）时才算真正的填充词，
 * 否则会把大量正常语句误判成"犹豫"——这是研究报告里提到的简单词表法的已知局限，
 * 这里用"是否紧跟停顿标记"做一个低成本的精度修正，而不是上更复杂的帧级模型。 */
const ALWAYS_FILLER = ['嗯', '呃'];
const CONDITIONAL_FILLER = ['这个', '那个'];
const PAUSE_MARK = /^[，,。.！!？?…\s]|^$/;

export interface FocusScoreResult {
  label: ScoreLabel;
  /** 0-1，综合分离阈值越远置信度越高。 */
  confidence: number;
  signals: {
    longPauseCount: number;
    speechRateVariance: number;
    fillerWordCount: number;
    fillerWordDensity: number;
  };
}

/** 停顿超过阈值的次数。 */
export function countLongPauses(silenceSegmentsSec: number[], thresholdSec: number): number {
  return silenceSegmentsSec.filter((s) => s >= thresholdSec).length;
}

/** 按 1 秒窗口切片，算每个窗口的"字/秒"，再取这组速率的方差——忽快忽慢 = 分心 / 不熟。
 * 窗口数不足 2 个时返回 0（数据太少，不判定）。 */
export function speechRateVariance(wordTimestamps: [number, number, string][]): number {
  if (wordTimestamps.length === 0) return 0;
  const windowSec = 3;
  const end = Math.max(...wordTimestamps.map(([, e]) => e));
  const windowCount = Math.ceil(end / windowSec);
  if (windowCount < 2) return 0;

  const rates: number[] = [];
  for (let w = 0; w < windowCount; w++) {
    const winStart = w * windowSec;
    const winEnd = winStart + windowSec;
    let chars = 0;
    for (const [start, wordEnd, text] of wordTimestamps) {
      if (start >= winStart && start < winEnd) chars += Array.from(text).length;
      void wordEnd;
    }
    rates.push(chars / windowSec);
  }
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  return variance;
}

/** 犹豫词在转写文本里的出现次数与密度（次数 / 总字数）。 */
export function fillerWordStats(transcript: string): { count: number; density: number } {
  const totalChars = Array.from(transcript).length;
  if (totalChars === 0) return { count: 0, density: 0 };

  let count = 0;
  for (const w of ALWAYS_FILLER) {
    count += transcript.split(w).length - 1;
  }
  for (const w of CONDITIONAL_FILLER) {
    let idx = transcript.indexOf(w);
    while (idx !== -1) {
      const after = transcript.slice(idx + w.length);
      if (PAUSE_MARK.test(after)) count++;
      idx = transcript.indexOf(w, idx + w.length);
    }
  }
  return { count, density: count / totalChars };
}

/** 综合专注度打分：100 分起，按信号加权扣分，映射到 高/中/低 三档。
 * 权重和阈值全部来自配置，不硬编码——运营/后续迭代可调，不用改代码。 */
export function scoreFocus(signals: AudioSignals, cfg: FocusScoringConfig): FocusScoreResult {
  const longPauseCount = countLongPauses(signals.silenceSegmentsSec, cfg.longPauseThresholdSec);
  const variance = speechRateVariance(signals.wordTimestamps);
  const filler = fillerWordStats(signals.transcript);

  const composite =
    100 -
    longPauseCount * cfg.longPauseWeight -
    variance * cfg.speechRateVarianceWeight -
    filler.density * 100 * cfg.fillerWordWeight;

  const label: ScoreLabel =
    composite >= cfg.highThreshold ? 'high' : composite >= cfg.mediumThreshold ? 'medium' : 'low';

  // 离阈值越远，置信度越高；离阈值很近时置信度低（值得双检）。
  const nearestBoundaryDistance = Math.min(
    Math.abs(composite - cfg.highThreshold),
    Math.abs(composite - cfg.mediumThreshold),
  );
  const confidence = Math.max(0.5, Math.min(1, 0.5 + nearestBoundaryDistance / 40));

  return {
    label,
    confidence,
    signals: {
      longPauseCount,
      speechRateVariance: variance,
      fillerWordCount: filler.count,
      fillerWordDensity: filler.density,
    },
  };
}
