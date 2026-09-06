import { describe, it, expect } from 'vitest';
import { RuleBasedSincerityEvaluator } from './rule-based-sincerity';

describe('RuleBasedSincerityEvaluator', () => {
  const evaluator = new RuleBasedSincerityEvaluator();

  it('回应呼应了请求的具体处境 -> 个性化高、真诚度高', async () => {
    const r = await evaluator.evaluate(
      '听说你最近考研压力很大，愿你静下心来，一步一步来，你已经很努力了',
      '最近考研压力很大，每天都很焦虑',
    );
    expect(r.personalization).toBe('high');
    expect(r.sincerity).toBe('high');
  });

  it('模板化回应完全没呼应请求内容 -> 个性化低', async () => {
    const r = await evaluator.evaluate('祝你天天开心万事如意', '最近考研压力很大，每天都很焦虑');
    expect(r.personalization).toBe('low');
  });

  it('内容极短 -> 真诚度低', async () => {
    const r = await evaluator.evaluate('嗯', '最近考研压力很大');
    expect(r.sincerity).toBe('low');
  });

  it('请求内容为空时不报错，个性化判低', async () => {
    const r = await evaluator.evaluate('愿你平安喜乐', '');
    expect(r.personalization).toBe('low');
  });
});
