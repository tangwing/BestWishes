// 真诚度 / 个性化评估。可插拔，P2 默认用规则实现；真实实现调用通用大模型 API，
// 内建偏差缓解（固定 rubric + few-shot 锚点、温度 0、双采样，见 design.md）。
// 输出恒为标签 + 置信度，不产出可比较的单一分数（vision.md 硬约束）。

import type { PersonalizationLabel, ScoreLabel } from '@bestwishes/domain';

export interface SincerityEvaluation {
  sincerity: ScoreLabel;
  sincerityConfidence: number;
  personalization: PersonalizationLabel;
}

export interface SincerityEvaluator {
  readonly name: string;
  /** transcript：回应的转写文本；requestContext：请求人的处境描述，用于判定"是否呼应"。 */
  evaluate(transcript: string, requestContext: string): Promise<SincerityEvaluation>;
}
