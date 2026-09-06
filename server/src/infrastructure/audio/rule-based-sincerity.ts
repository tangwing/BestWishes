// P2 默认的真诚度 / 个性化评估：不接真实大模型，用简单的字符重合度规则近似判定。
// 真实实现会调用通用大模型 API，带偏差缓解（固定 rubric + few-shot 锚点 + 温度0 +
// 双采样，见 design.md）。这个规则实现只是让整条管线在没有大模型账号时也能跑通、
// 可测试——不是对"真诚"这件事的严肃判定，仅供 demo 阶段占位。

import type { PersonalizationLabel, ScoreLabel } from '@bestwishes/domain';
import type { SincerityEvaluation, SincerityEvaluator } from '../../ports/sincerity-evaluator';

function meaningfulChars(text: string): Set<string> {
  return new Set(Array.from(text).filter((c) => !/[\s，,。.！!？?、；;：:""''（）()]/.test(c)));
}

export class RuleBasedSincerityEvaluator implements SincerityEvaluator {
  readonly name = 'rule-based-sincerity';

  evaluate(transcript: string, requestContext: string): Promise<SincerityEvaluation> {
    const transcriptChars = meaningfulChars(transcript);
    const contextChars = meaningfulChars(requestContext);

    let overlap = 0;
    for (const c of contextChars) if (transcriptChars.has(c)) overlap++;
    const overlapRatio = contextChars.size === 0 ? 0 : overlap / contextChars.size;

    const personalization: PersonalizationLabel =
      overlapRatio >= 0.3 ? 'high' : overlapRatio >= 0.1 ? 'moderate' : 'low';

    // 真诚度的规则代理：呼应了请求内容 + 有一定篇幅，姑且判"较真诚"；
    // 极短或完全没呼应的判"低"。真实场景这条必须换成 LLM 评估，规则版
    // 精度有限，仅用于跑通管线。
    const len = Array.from(transcript.trim()).length;
    const sincerity: ScoreLabel = overlapRatio >= 0.3 && len >= 10 ? 'high' : len >= 10 ? 'medium' : 'low';
    // 规则代理天然置信度不高，低于 LLM 双采样一致的情况——诚实反映这一点，
    // 让置信度较低的结果有机会被人工复核规则捕获。
    const sincerityConfidence = 0.6;

    return Promise.resolve({ sincerity, sincerityConfidence, personalization });
  }
}
