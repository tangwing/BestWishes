import { describe, it, expect, beforeEach } from 'vitest';
import { store } from './repo';
import type { Personalization } from '../domain/types';

const p = (over: Partial<Personalization> = {}): Personalization => ({
  toName: '阿明',
  fromName: '小林',
  fromCity: '杭州',
  ...over,
});

function setup(city = '杭州') {
  store.resetAll();
  store.loginStub('小林', city, 480);
  store.recordConsent({ featured: true, synthesis: false });
}

describe('端到端 — 提交 → hold → 送达 → 撤回', () => {
  beforeEach(() => setup());

  it('提交后处于 verifying，访客看到"准备中"', () => {
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天。',
      personalization: p(),
      occasion: 'daily',
    });
    const page = store.getPublicPage(slug);
    expect(page.type).toBe('preparing');
    expect(page.content).toBeUndefined();
  });

  it('hold 结束后自动送达，访客看到正文', () => {
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天。',
      personalization: p(),
      occasion: 'daily',
    });
    store.advanceClock(7000);
    const page = store.getPublicPage(slug);
    expect(page.type).toBe('content');
    expect(page.content?.body).toContain('温柔以待');
    expect(page.content?.fromLine).toBe('来自 杭州 的 小林');
    expect(store.getStreak().total).toBe(1);
  });

  it('校验期作者可取消（verifying → withdrawn），不影响坚持记录', () => {
    const { id, slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天。',
      personalization: p(),
      occasion: 'daily',
    });
    expect(store.blessingById(id)?.state).toBe('verifying');
    store.withdraw(id);
    expect(store.blessingById(id)?.state).toBe('withdrawn');
    expect(store.getPublicPage(slug).type).toBe('withdrawn');
    expect(store.getStreak().total).toBe(0);
    // 取消后即便时钟前进也不会被 reconcile 发布
    store.advanceClock(7000);
    expect(store.blessingById(id)?.state).toBe('withdrawn');
  });

  it('撤回后访客看到"已被收回"，坚持记录回撤', () => {
    const { id, slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天。',
      personalization: p(),
      occasion: 'daily',
    });
    store.advanceClock(7000);
    expect(store.getStreak().total).toBe(1);
    store.withdraw(id);
    expect(store.getPublicPage(slug).type).toBe('withdrawn');
    expect(store.getStreak().total).toBe(0);
  });

  it('删除后不在作者列表，落地页不返回正文', () => {
    const { id, slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天。',
      personalization: p(),
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.withdraw(id);
    store.deleteBlessing(id);
    expect(store.myBlessings().find((b) => b.id === id)).toBeUndefined();
    expect(store.getPublicPage(slug).content).toBeUndefined();
  });
});

describe('端到端 — 护栏词 / 违禁词', () => {
  beforeEach(() => setup());

  it('命中护栏词 → suspect → 进队列 → 人工通过 → 送达', () => {
    const { slug, id } = store.submitBlessing({
      body: '愿你平安，如需超度收费请私信，我们提供服务。',
      personalization: p(),
      occasion: 'remembrance',
    });
    expect(store.blessingById(id)?.state).toBe('verifying');
    const queue = store.moderationQueue();
    expect(queue.length).toBe(1);
    expect(store.getPublicPage(slug).type).toBe('preparing');

    store.resolveReport(queue[0].id, 'pass', '经复核为正常悼念内容');
    expect(store.blessingById(id)?.state).toBe('published');
    expect(store.getPublicPage(slug).type).toBe('content');
  });

  it('命中违禁词 → rejected → 访客中性占位', () => {
    const { slug, id } = store.submitBlessing({
      body: '祝你好运，记得参与刷单返利活动，轻松赚钱。',
      personalization: p(),
      occasion: 'daily',
    });
    expect(store.blessingById(id)?.state).toBe('rejected');
    expect(store.getPublicPage(slug).type).toBe('taken_down');
  });

  it('审核服务不可用 → 保守：保持 verifying + 进队列', () => {
    store.setModerationMode('unavailable');
    const { id } = store.submitBlessing({
      body: '愿你健康平安，喜乐常在，日子顺遂。',
      personalization: p(),
      occasion: 'recovery',
    });
    expect(store.blessingById(id)?.state).toBe('verifying');
    expect(store.moderationQueue().length).toBe(1);
    store.setModerationMode('normal');
  });
});

describe('端到端 — 链接到期与续期', () => {
  beforeEach(() => setup());

  it('到期 → expired 占位 → 续期 → 恢复可见，且不重新审核', () => {
    const { id, slug } = store.submitBlessing({
      body: '愿你新的一岁睡得安稳，笑得开怀，被世界温柔以待。',
      personalization: p(),
      occasion: 'birthday',
    });
    store.advanceClock(7000);
    expect(store.getPublicPage(slug).type).toBe('content');

    store.advanceClock(121 * 86_400_000); // 超过 120 天 TTL
    expect(store.getPublicPage(slug).type).toBe('expired');
    expect(store.blessingById(id)?.state).toBe('expired');

    // 链接过期不回撤坚持记录（人那天确实写了）
    expect(store.getStreak().total).toBe(1);

    store.renew(id);
    expect(store.blessingById(id)?.state).toBe('published');
    expect(store.getPublicPage(slug).type).toBe('content');
    // 续期不重复加计数
    expect(store.getStreak().total).toBe(1);
    // 续期不建新工单
    expect(store.moderationQueue().length).toBe(0);
  });
});

describe('举报', () => {
  beforeEach(() => setup());

  it('高危举报即时临时下架 + 高优先级工单', () => {
    const { slug, id } = store.submitBlessing({
      body: '愿你平安顺遂，一切都好，心想事成常在。',
      personalization: p(),
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.report(slug, 'illegal', '疑似违法', 'visitor-fp-1');
    expect(store.blessingById(id)?.state).toBe('taken_down');
    expect(store.moderationQueue()[0].priority).toBe(90);
  });

  it('同一来源重复举报合并计数', () => {
    const { slug } = store.submitBlessing({
      body: '愿你平安顺遂，一切都好，心想事成常在。',
      personalization: p(),
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.report(slug, 'offensive', 'x', 'fp-A');
    store.report(slug, 'offensive', 'x', 'fp-A');
    const tickets = store.moderationQueue().filter((r) => r.origin === 'report');
    expect(tickets.length).toBe(1);
    expect(tickets[0].count).toBe(2);
  });
});

describe('校验规则', () => {
  beforeEach(() => setup());

  it('正文过短被拒绝', () => {
    expect(() =>
      store.submitBlessing({ body: '祝好', personalization: p(), occasion: 'daily' }),
    ).toThrow();
  });

  it('缺少称呼被拒绝', () => {
    expect(() =>
      store.submitBlessing({
        body: '愿你平安顺遂，一切都好，心想事成常在。',
        personalization: p({ toName: '' }),
        occasion: 'daily',
      }),
    ).toThrow();
  });

  it('未同意协议不能提交', () => {
    store.resetAll();
    store.loginStub('小林', '杭州', 480);
    expect(() =>
      store.submitBlessing({
        body: '愿你平安顺遂，一切都好，心想事成常在。',
        personalization: p(),
        occasion: 'daily',
      }),
    ).toThrow();
  });

  it('草稿不生成链接、不进审核', () => {
    store.saveDraft('随便写点什么', p(), 'daily');
    expect(store.moderationQueue().length).toBe(0);
    expect(store.getDraft()?.body).toBe('随便写点什么');
  });
});

describe('跨时区坚持记录', () => {
  it('按作者所在地区自然日聚合', () => {
    store.resetAll();
    // UTC-5，纽约
    store.loginStub('Nina', 'New York', -300);
    store.recordConsent({ featured: false, synthesis: false });
    const { id } = store.submitBlessing({
      body: 'May you be held gently by the world, today and always, dear friend.',
      personalization: { toName: 'Sam' },
      occasion: 'daily',
    });
    store.advanceClock(7000);
    const view = store.getStreak();
    expect(view.total).toBe(1);
    expect(view.byDay[0].count).toBe(1);
    expect(store.blessingById(id)?.state).toBe('published');
  });
});
