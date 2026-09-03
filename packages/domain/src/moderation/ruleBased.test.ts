import { describe, it, expect } from 'vitest';
import { RuleBasedProvider, UnavailableProvider } from './ruleBased';
import type { ModerationInput, ModerationProvider } from '../types';

function input(text: string): ModerationInput {
  return { text };
}

const p = new RuleBasedProvider();

describe('RuleBasedProvider — 三档判定', () => {
  it('命中违禁词 → violation', async () => {
    const r = await p.check(input('祝你天天开心，记得刷单返利哦'));
    expect(r.verdict).toBe('violation');
    expect(r.categories).toContain('fraud');
  });

  it('命中拉客 / 敛财护栏词 → 至少 suspect', async () => {
    const r = await p.check(input('愿你平安喜乐，需要超度收费请联系我们'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('solicitation');
  });

  it('护栏词可配置为 violation', async () => {
    const strict = new RuleBasedProvider({ guardAsViolation: true });
    const r = await strict.check(input('提供付费代祷服务，愿你安康'));
    expect(r.verdict).toBe('violation');
  });

  it('疑似联系方式 / 站外导流 → suspect(contact_leak)', async () => {
    const r = await p.check(input('祝福你，加我微信 blessing_shop_888 领礼物'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('contact_leak');
  });

  it('带链接的广告 → suspect(contact_leak)', async () => {
    const r = await p.check(input('祝你好运，更多惊喜见 www.example-shop.com 快去看看吧'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('contact_leak');
  });

  it('正文过短 → suspect(low_effort)', async () => {
    const r = await p.check(input('祝好'));
    expect(r.verdict).toBe('suspect');
    expect(r.categories).toContain('low_effort');
  });

  it('刷屏 / 无效内容 → violation(low_effort)', async () => {
    const r = await p.check(input('啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊'));
    expect(r.verdict).toBe('violation');
    expect(r.categories).toContain('low_effort');
  });

  it('平淡但合规 → pass（审核不评质量）', async () => {
    const r = await p.check(input('祝你生日快乐，平安顺遂，心想事成。'));
    expect(r.verdict).toBe('pass');
    expect(r.categories).toEqual([]);
  });

  it('乱码正文 → violation 或 suspect（不放行）', async () => {
    const r = await p.check(input('@@@###$$$%%%^^^&&&***(((]]][[[///\\\\\\'));
    expect(r.verdict).not.toBe('pass');
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
