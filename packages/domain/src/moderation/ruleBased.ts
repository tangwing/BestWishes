// P1 的规则实现。对应 specs/content-moderation「可插拔的内容审核接口」+「自动检查的三档判定」。

import type {
  ModerationCategory,
  ModerationInput,
  ModerationProvider,
  ModerationResult,
} from '../types';
import type { P1Config } from '../config';
import { DEFAULT_CONFIG } from '../config';
import { BANNED, RELIGIOUS_SOLICITATION_GUARD, CONTACT_PATTERNS } from './words';

export interface RuleBasedOptions {
  config?: P1Config;
  /** 宗教敛财护栏命中时是否直接判 violation（默认 suspect） */
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
    const haystack = [
      input.text,
      input.personalization.toName,
      input.personalization.fromName ?? '',
    ].join('\n');

    const violationCats: ModerationCategory[] = [];
    for (const [cat, words] of Object.entries(BANNED)) {
      if (words.some((w) => haystack.includes(w))) {
        violationCats.push(cat as ModerationCategory);
      }
    }
    if (violationCats.length > 0) {
      return { verdict: 'violation', categories: violationCats, providerRef: this.name };
    }

    const suspectCats: ModerationCategory[] = [];

    if (RELIGIOUS_SOLICITATION_GUARD.some((w) => haystack.includes(w))) {
      if (this.guardAsViolation) {
        return {
          verdict: 'violation',
          categories: ['religious_solicitation'],
          providerRef: this.name,
        };
      }
      suspectCats.push('religious_solicitation');
    }

    if (CONTACT_PATTERNS.some((re) => re.test(haystack))) {
      suspectCats.push('contact_leak');
    }

    // 按码位数，中文一个字算一个（不是 UTF-16 单元）
    const bodyLen = Array.from(input.text.trim()).length;
    if (bodyLen < this.cfg.bodyMinLen || bodyLen > this.cfg.bodyMaxLen) {
      suspectCats.push('malformed');
    }
    // 疑似乱码：可打印字符里 CJK + 字母 + 常见标点占比过低
    const meaningful = (input.text.match(/[\p{Script=Han}a-zA-Z，。！？、；：（）,.!?]/gu) ?? [])
      .length;
    if (bodyLen >= this.cfg.bodyMinLen && meaningful / bodyLen < 0.5) {
      suspectCats.push('malformed');
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
