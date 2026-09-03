// P1 的规则实现。对应 specs/content-moderation「可插拔的内容审核接口」+「自动检查的三档判定」。

import type {
  ModerationCategory,
  ModerationInput,
  ModerationProvider,
  ModerationResult,
} from '../types';
import type { P1Config } from '../config';
import { DEFAULT_CONFIG } from '../config';
import { BANNED, CONTACT_PATTERNS, SOLICITATION_GUARD, isLowEffort, looksGarbled } from './words';

export interface RuleBasedOptions {
  config?: P1Config;
  /** 拉客 / 敛财护栏命中时是否直接判 violation（默认 suspect） */
  guardAsViolation?: boolean;
}

export class RuleBasedProvider implements ModerationProvider {
  readonly name = 'rule-based';
  private readonly cfg: P1Config;
  private readonly guardAsViolation: boolean;

  constructor(opts: RuleBasedOptions = {}) {
    this.cfg = opts.config ?? DEFAULT_CONFIG;
    this.guardAsViolation = opts.guardAsViolation ?? false;
  }

  check(input: ModerationInput): Promise<ModerationResult> {
    return Promise.resolve(this.checkSync(input));
  }

  checkSync(input: ModerationInput): ModerationResult {
    const text = input.text;

    const violationCats: ModerationCategory[] = [];
    for (const [cat, words] of Object.entries(BANNED)) {
      if (words.some((w) => text.includes(w))) {
        violationCats.push(cat as ModerationCategory);
      }
    }
    // 明显无效内容（刷屏 / 空 / 全标点）直接判违规，不占人工队列
    if (isLowEffort(text)) {
      violationCats.push('low_effort');
    }
    if (violationCats.length > 0) {
      return {
        verdict: 'violation',
        categories: [...new Set(violationCats)],
        providerRef: this.name,
      };
    }

    const suspectCats: ModerationCategory[] = [];

    if (SOLICITATION_GUARD.some((w) => text.includes(w))) {
      if (this.guardAsViolation) {
        return { verdict: 'violation', categories: ['solicitation'], providerRef: this.name };
      }
      suspectCats.push('solicitation');
    }

    if (CONTACT_PATTERNS.some((re) => re.test(text))) {
      suspectCats.push('contact_leak');
    }

    // 按码位数，中文一个字算一个（不是 UTF-16 单元）
    const bodyLen = Array.from(text.trim()).length;
    if (bodyLen < this.cfg.bodyMinLen || bodyLen > this.cfg.bodyMaxLen) {
      suspectCats.push('low_effort');
    }
    if (bodyLen >= this.cfg.bodyMinLen && looksGarbled(text)) {
      suspectCats.push('spam');
    }

    if (suspectCats.length > 0) {
      return {
        verdict: 'suspect',
        categories: [...new Set(suspectCats)],
        providerRef: this.name,
      };
    }

    return { verdict: 'pass', categories: [], providerRef: this.name };
  }
}

/** 模拟审核服务不可用。调用方须保守处理（维持 hold + 进队列）。 */
export class UnavailableProvider implements ModerationProvider {
  readonly name = 'unavailable';
  check(_input: ModerationInput): Promise<ModerationResult> {
    return Promise.resolve({
      verdict: 'suspect',
      categories: [],
      providerRef: this.name,
      unavailable: true,
    });
  }
}
