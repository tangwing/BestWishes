import { describe, it, expect } from 'vitest';
import { RuleBasedProvider, UnavailableProvider } from './ruleBased';
import type { ModerationInput, ModerationProvider } from '../types';

function input(
  text: string,
  over: Partial<ModerationInput['personalization']> = {},
): ModerationInput {
  return { text, personalization: { toName: '小明', ...over } };
}

const p = new RuleBasedProvider();

describe('RuleBasedProvider — 三档判定', () => {
  it('命中违禁词 → violation', async () => {
    const r = await p.check(input('祝你天天开心，记得刷单返利哦'));
    expect(r.verdict).toBe('violation');
    expect(r.categories).toContain('fraud');
  });

  it('命中宗教敛财护栏词 → 至少 suspect', async () => {
    const r = await p.check(input('愿你平安喜乐，需要超度收费请联系我们'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('religious_solicitation');
  });

  it('护栏词可配置为 violation', async () => {
    const strict = new RuleBasedProvider({ guardAsViolation: true });
    const r = await strict.check(input('提供付费代祷服务，愿你安康'));
    expect(r.verdict).toBe('violation');
  });

  it('疑似联系方式导流 → suspect', async () => {
    const r = await p.check(input('祝福你，加我微信 blessing_shop_888 领礼物'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('contact_leak');
  });

  it('正文过短 → suspect(malformed)', async () => {
    const r = await p.check(input('祝好'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('malformed');
  });

  it('平淡但合规 → pass（审核不评质量）', async () => {
    const r = await p.check(input('祝你生日快乐，平安顺遂，心想事成。'));
    expect(r.verdict).toBe('pass');
    expect(r.categories).toEqual([]);
  });

  it('乱码正文 → suspect(malformed)', async () => {
    const r = await p.check(input('@@@###$$$%%%^^^&&&***(((]]][[[///\\\\\\'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('malformed');
  });

  it('也检查个性化字段（落款里的违禁词）', async () => {
    const r = await p.check(
      input('愿你被这个世界温柔以待，平安喜乐每一天。', { fromName: '内部中奖速来' }),
    );
    expect(r.verdict).toBe('violation');
  });
});

describe('UnavailableProvider — 保守', () => {
  it('返回 unavailable 标记', async () => {
    const r = await new UnavailableProvider().check(input('任意内容'));
    expect(r.unavailable).toBe(true);
  });
});

describe('契约测试 — 更换实现不改调用方契约', () => {
  const providers: ModerationProvider[] = [new RuleBasedProvider(), new UnavailableProvider()];
  for (const prov of providers) {
    it(`${prov.name} 返回 {verdict, categories}`, async () => {
      const r = await prov.check(input('祝你一切都好，平安顺遂常在。'));
      expect(['pass', 'suspect', 'violation']).toContain(r.verdict);
      expect(Array.isArray(r.categories)).toBe(true);
    });
  }
});
