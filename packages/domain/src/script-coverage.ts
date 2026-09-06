// 稿子朗读完整性的近似判定（纯函数）。design.md 里说得很明白：P2 先用简单的字符覆盖率
// 近似实现，不接入真实的强制对齐工具（Charsiu 等）——那是后续硬化项，见 BACKLOG。
// 没有稿子时，只判断转写文本是否构成"有效表达"，复用文本审核已有的刷屏/乱码判定，
// 不做逐字覆盖率评估。

import { isLowEffort, looksGarbled } from './moderation/words';
import type { CompletenessLabel } from './types';

const COMPLETE_THRESHOLD = 0.8;
const PARTIAL_THRESHOLD = 0.4;

function splitIntoClauses(text: string): string[] {
  return text
    .split(/[。！？，,.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function charSet(text: string): Set<string> {
  return new Set(Array.from(text).filter((c) => !/\s/.test(c)));
}

/** 单个稿子片段（分句）在转写文本里的覆盖率：片段字符集与转写字符集的交集占比。 */
function clauseCoverage(clause: string, transcriptChars: Set<string>): number {
  const clauseChars = charSet(clause);
  if (clauseChars.size === 0) return 1;
  let hit = 0;
  for (const c of clauseChars) if (transcriptChars.has(c)) hit++;
  return hit / clauseChars.size;
}

export interface ScriptCoverageResult {
  label: CompletenessLabel;
  /** 0-1，全部分句覆盖率的平均值。 */
  coverage: number;
}

/** 有稿子时：按分句算字符覆盖率，取平均，映射到 完整/部分/明显不完整 三档。 */
export function scoreScriptCoverage(scriptText: string, transcript: string): ScriptCoverageResult {
  const clauses = splitIntoClauses(scriptText);
  if (clauses.length === 0) return { label: 'incomplete', coverage: 0 };

  const transcriptChars = charSet(transcript);
  const coverages = clauses.map((c) => clauseCoverage(c, transcriptChars));
  const coverage = coverages.reduce((a, b) => a + b, 0) / coverages.length;

  const label: CompletenessLabel =
    coverage >= COMPLETE_THRESHOLD ? 'complete' : coverage >= PARTIAL_THRESHOLD ? 'partial' : 'incomplete';

  return { label, coverage };
}

/** 无稿子时：只判断转写文本是否构成有效表达（非空、非刷屏、非乱码）。 */
export function scoreFreeformCompleteness(transcript: string): CompletenessLabel {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return 'incomplete';
  if (isLowEffort(trimmed) || looksGarbled(trimmed)) return 'incomplete';
  return 'complete';
}

/** 统一入口：有稿子走覆盖率对齐，没稿子走自由表达判定。 */
export function scoreCompleteness(
  scriptText: string | null,
  transcript: string,
): CompletenessLabel {
  if (scriptText && scriptText.trim().length > 0) {
    return scoreScriptCoverage(scriptText, transcript).label;
  }
  return scoreFreeformCompleteness(transcript);
}
