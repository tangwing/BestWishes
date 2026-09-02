// 原型的"应用服务层" —— 把领域模块 + 内存/localStorage 存储 + 规则审核编排起来。
// 对标 docs/architecture/p1-architecture.md §8 的后端 API。不是生产实现。

import {
  Blessing,
  BlessingEvent,
  BlessingState,
  LifecycleActor,
  LifecycleTrigger,
  ModerationResult,
  Occasion,
  Personalization,
  ReportCategory,
  ReportOrigin,
  ReportState,
} from '../domain/types';
import { applyTrigger } from '../domain/lifecycle';
import { placeholderType, PlaceholderType, PLACEHOLDER_TEXT } from '../domain/visibility';
import {
  StreakData,
  currentStreak,
  localDateFor,
  recordPublish,
  recordUnpublish,
  totalPublished,
} from '../domain/streak';
import { RuleBasedProvider, UnavailableProvider } from '../domain/moderation/ruleBased';
import { outcomeFor } from '../domain/moderation/apply';
import { DEFAULT_CONFIG, P1Config } from '../domain/config';
import { seedTemplates, Template } from './seed';

const STORAGE_KEY = 'bw_p1_state_v1';
const AGREEMENT_VERSION = '2026-09-02';
/** 原型里把"几分钟 hold"压缩成几秒，方便走查 */
const PASS_HOLD_MS = 6000;

export interface User {
  id: string;
  nickname: string;
  city: string;
  utcOffsetMinutes: number;
  source: string;
}

export interface Consent {
  userId: string;
  agreementVersion: string;
  scopeDeliver: true;
  scopeFeatured: boolean;
  scopeSynthesis: boolean;
  agreedAt: string;
}

export interface Draft {
  userId: string;
  body: string;
  personalization: Personalization;
  occasion: Occasion;
  updatedAt: string;
}

export interface Report {
  id: string;
  blessingId: string;
  origin: ReportOrigin;
  category: ReportCategory;
  state: ReportState;
  priority: number;
  note?: string;
  reporterFingerprint?: string;
  count: number;
  createdAt: string;
  resolvedAt?: string;
  timeline: { at: string; text: string }[];
}

interface PersistState {
  users: User[];
  consents: Consent[];
  drafts: Draft[];
  blessings: (Blessing & {
    pendingPublishAt?: string;
    holdStartedAt?: string;
    countedInStreak?: boolean;
  })[];
  reports: Report[];
  streaks: Record<string, StreakData>;
  sessionUserId: string | null;
  clockOffsetMs: number;
  config: P1Config;
  moderationMode: 'normal' | 'guard_as_violation' | 'unavailable';
}

function emptyState(): PersistState {
  return {
    users: [],
    consents: [],
    drafts: [],
    blessings: [],
    reports: [],
    streaks: {},
    sessionUserId: null,
    clockOffsetMs: 0,
    config: { ...DEFAULT_CONFIG },
    moderationMode: 'normal',
  };
}

type Listener = () => void;

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function slug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

export interface PublicPage {
  type: PlaceholderType;
  placeholderText?: string;
  content?: {
    body: string;
    fromLine: string;
    toName: string;
    occasion: Occasion;
    publishedAt: string;
  };
}

export interface StreakView {
  total: number;
  streak: number;
  byDay: { date: string; count: number }[];
}

class Store {
  private state: PersistState;
  private listeners = new Set<Listener>();
  private templates: Template[];
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = this.load();
    this.templates = seedTemplates();
  }

  // ---------- persistence & clock ----------

  private load(): PersistState {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...emptyState(), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return emptyState();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l());
  }

  now(): Date {
    return new Date(Date.now() + this.state.clockOffsetMs);
  }

  advanceClock(ms: number): void {
    this.state.clockOffsetMs += ms;
    this.reconcile();
    this.save();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    if (!this.tickHandle) {
      this.tickHandle = setInterval(() => this.reconcile(), 1000);
    }
    return () => {
      this.listeners.delete(l);
      if (this.listeners.size === 0 && this.tickHandle) {
        clearInterval(this.tickHandle);
        this.tickHandle = null;
      }
    };
  }

  resetAll(): void {
    this.state = emptyState();
    this.save();
  }

  getConfig(): P1Config {
    return this.state.config;
  }

  setFeaturedDefault(on: boolean): void {
    this.state.config.featuredDefaultOn = on;
    this.save();
  }

  getModerationMode(): PersistState['moderationMode'] {
    return this.state.moderationMode;
  }

  setModerationMode(m: PersistState['moderationMode']): void {
    this.state.moderationMode = m;
    this.save();
  }

  // ---------- reconcile loop (对标"定时任务") ----------

  private reconcile(): void {
    const now = this.now();
    let changed = false;
    for (const b of this.state.blessings) {
      if (b.state === 'verifying' && b.pendingPublishAt && new Date(b.pendingPublishAt) <= now) {
        this.transition(b, 'auto_pass', { kind: 'system' }, '延迟送达 hold 结束');
        delete b.pendingPublishAt;
        delete b.holdStartedAt;
        changed = true;
      } else if (
        b.state === 'verifying' &&
        b.holdStartedAt &&
        now.getTime() - new Date(b.holdStartedAt).getTime() >
          this.state.config.holdTimeoutHours * 3600_000
      ) {
        // hold 超时：升级（原型里只打标记，不改状态）
        if (!b.events.some((e) => e.reason === 'hold 超时已升级')) {
          b.events.push({
            from: 'verifying',
            to: 'verifying',
            trigger: 'submit',
            actor: { kind: 'system' },
            reason: 'hold 超时已升级',
            at: now.toISOString(),
          });
          changed = true;
        }
      } else if (
        b.state === 'published' &&
        b.expiresAt &&
        new Date(b.expiresAt) <= now
      ) {
        this.transition(b, 'expire', { kind: 'system' }, '链接到期');
        changed = true;
      }
    }
    if (changed) this.save();
  }

  // ---------- auth ----------

  loginStub(nickname: string, city: string, utcOffsetMinutes = 480): User {
    const existing = this.state.users.find((u) => u.nickname === nickname && u.city === city);
    if (existing) {
      this.state.sessionUserId = existing.id;
      this.save();
      return existing;
    }
    const user: User = {
      id: rid('usr'),
      nickname: nickname || '匿名的祝福者',
      city: city || '未知',
      utcOffsetMinutes,
      source: 'stub-login',
    };
    this.state.users.push(user);
    this.state.sessionUserId = user.id;
    this.save();
    return user;
  }

  logout(): void {
    this.state.sessionUserId = null;
    this.save();
  }

  currentUser(): User | null {
    return this.state.users.find((u) => u.id === this.state.sessionUserId) ?? null;
  }

  private requireUser(): User {
    const u = this.currentUser();
    if (!u) throw new Error('需要登录');
    return u;
  }

  // ---------- agreement / consent ----------

  getAgreement(): { version: string; featuredDefaultOn: boolean } {
    return { version: AGREEMENT_VERSION, featuredDefaultOn: this.state.config.featuredDefaultOn };
  }

  currentConsent(): Consent | null {
    const u = this.currentUser();
    if (!u) return null;
    return (
      this.state.consents
        .filter((c) => c.userId === u.id && c.agreementVersion === AGREEMENT_VERSION)
        .slice(-1)[0] ?? null
    );
  }

  recordConsent(opts: { featured: boolean; synthesis: boolean }): Consent {
    const u = this.requireUser();
    const consent: Consent = {
      userId: u.id,
      agreementVersion: AGREEMENT_VERSION,
      scopeDeliver: true,
      scopeFeatured: opts.featured,
      scopeSynthesis: opts.synthesis,
      agreedAt: this.now().toISOString(),
    };
    this.state.consents.push(consent);
    this.save();
    return consent;
  }

  hasValidConsent(): boolean {
    return this.currentConsent() !== null;
  }

  // ---------- templates & drafts ----------

  getTemplates(): Template[] {
    return this.templates;
  }

  getDraft(): Draft | null {
    const u = this.currentUser();
    if (!u) return null;
    return this.state.drafts.find((d) => d.userId === u.id) ?? null;
  }

  saveDraft(body: string, personalization: Personalization, occasion: Occasion): Draft {
    const u = this.requireUser();
    const existing = this.state.drafts.find((d) => d.userId === u.id);
    const draft: Draft = {
      userId: u.id,
      body,
      personalization,
      occasion,
      updatedAt: this.now().toISOString(),
    };
    if (existing) Object.assign(existing, draft);
    else this.state.drafts.push(draft);
    this.save();
    return draft;
  }

  private clearDraft(userId: string): void {
    this.state.drafts = this.state.drafts.filter((d) => d.userId !== userId);
  }

  // ---------- blessing lifecycle ----------

  validateBody(body: string): string | null {
    const len = [...body.trim()].length;
    if (len === 0) return '请写下祝福正文';
    if (len < this.state.config.bodyMinLen)
      return `再多写一点吧（至少 ${this.state.config.bodyMinLen} 字）`;
    if (len > this.state.config.bodyMaxLen)
      return `有点长了，精简到 ${this.state.config.bodyMaxLen} 字以内`;
    return null;
  }

  private moderator() {
    switch (this.state.moderationMode) {
      case 'unavailable':
        return new UnavailableProvider();
      case 'guard_as_violation':
        return new RuleBasedProvider({ config: this.state.config, guardAsViolation: true });
      default:
        return new RuleBasedProvider({ config: this.state.config });
    }
  }

  private transition(
    b: PersistState['blessings'][number],
    trigger: LifecycleTrigger,
    actor: LifecycleActor,
    reason?: string,
  ): void {
    const res = applyTrigger(b.state, trigger);
    if (!res.ok) throw new Error(res.reason);
    const from = b.state;
    const to = res.next;
    const now = this.now();
    const ev: BlessingEvent = { from, to, trigger, actor, reason, at: now.toISOString() };
    b.events.push(ev);
    b.state = to;

    if (to === 'published' && from !== 'expired') {
      b.publishedAt = now.toISOString();
      b.expiresAt = new Date(
        now.getTime() + this.state.config.linkTtlDays * 86_400_000,
      ).toISOString();
      this.bumpStreak(b, +1);
      b.countedInStreak = true;
    }
    if (to === 'published' && from === 'expired') {
      // 续期：顺延有效期，不加 streak（本就一直在计数里）
      b.expiresAt = new Date(
        now.getTime() + this.state.config.linkTtlDays * 86_400_000,
      ).toISOString();
      b.renewCount += 1;
    }
    // 坚持记录只在作者主动收回 / 平台下架时回撤——链接过期不回撤。
    if (b.countedInStreak && (to === 'withdrawn' || to === 'deleted' || to === 'taken_down')) {
      this.bumpStreak(b, -1);
      b.countedInStreak = false;
    }
  }

  private bumpStreak(b: Blessing, delta: number): void {
    const author = this.state.users.find((u) => u.id === b.authorId);
    if (!author || !b.publishedAt) return;
    const day = localDateFor(new Date(b.publishedAt), author.utcOffsetMinutes);
    const data = this.state.streaks[b.authorId] ?? {};
    this.state.streaks[b.authorId] =
      delta > 0 ? recordPublish(data, day) : recordUnpublish(data, day);
  }

  submitBlessing(input: {
    body: string;
    personalization: Personalization;
    occasion: Occasion;
  }): { id: string; slug: string; state: BlessingState } {
    const u = this.requireUser();
    if (!this.hasValidConsent()) throw new Error('请先同意《用户内容与授权协议》');
    if (!input.personalization.toName?.trim()) throw new Error('请填写"给谁"');
    const bodyErr = this.validateBody(input.body);
    if (bodyErr) throw new Error(bodyErr);

    const now = this.now();
    const b: PersistState['blessings'][number] = {
      id: rid('bls'),
      authorId: u.id,
      body: input.body.trim(),
      personalization: input.personalization,
      occasion: input.occasion,
      state: 'draft',
      slug: slug(),
      createdAt: now.toISOString(),
      publishedAt: null,
      expiresAt: null,
      moderation: null,
      renewCount: 0,
      events: [],
    };
    this.transition(b, 'submit', { kind: 'author', userId: u.id }, '作者提交');
    b.holdStartedAt = now.toISOString();
    this.state.blessings.push(b);
    this.clearDraft(u.id);

    // 同步跑规则审核（对标 design D4：请求内同步校验）
    const mod = this.moderator();
    const result: ModerationResult =
      mod instanceof RuleBasedProvider ? mod.checkSync({ text: b.body, personalization: b.personalization }) : { verdict: 'suspect', categories: [], unavailable: true };
    b.moderation = result;
    const outcome = outcomeFor(result);

    if (outcome.trigger === 'auto_violation') {
      this.transition(b, 'auto_violation', { kind: 'system' }, `命中：${result.categories.join(',')}`);
    } else if (outcome.trigger === 'auto_pass') {
      // pass：hold PASS_HOLD_MS 后由 reconcile 发布（模拟"平台 hold 几分钟"）
      b.pendingPublishAt = new Date(now.getTime() + PASS_HOLD_MS).toISOString();
    }
    if (outcome.createTicket) {
      this.createReport(b.id, outcome.ticketOrigin ?? 'auto_suspect', result.categories[0] ?? 'other', {
        note: outcome.note,
        priority: 30,
      });
    }
    this.save();
    return { id: b.id, slug: b.slug, state: b.state };
  }

  myBlessings(): Blessing[] {
    const u = this.currentUser();
    if (!u) return [];
    return this.state.blessings
      .filter((b) => b.authorId === u.id && b.state !== 'deleted')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private findOwn(id: string): PersistState['blessings'][number] {
    const u = this.requireUser();
    const b = this.state.blessings.find((x) => x.id === id && x.authorId === u.id);
    if (!b) throw new Error('祝福不存在');
    return b;
  }

  withdraw(id: string): void {
    const b = this.findOwn(id);
    const wasVerifying = b.state === 'verifying';
    this.transition(b, 'withdraw', { kind: 'author', userId: this.requireUser().id }, '作者撤回');
    // 校验期撤回：清掉待发布定时与审核 hold，避免 reconcile 之后又把它发布
    delete b.pendingPublishAt;
    delete b.holdStartedAt;
    if (wasVerifying) {
      for (const r of this.state.reports) {
        if (r.blessingId === b.id && r.origin === 'auto_suspect' && (r.state === 'open' || r.state === 'in_review')) {
          r.state = 'resolved_pass';
          r.resolvedAt = this.now().toISOString();
          r.timeline.push({ at: this.now().toISOString(), text: '作者在校验期撤回，工单关闭' });
        }
      }
    }
    this.save();
  }

  republish(id: string): void {
    const b = this.findOwn(id);
    this.transition(b, 'republish', { kind: 'author', userId: b.authorId }, '作者重新发布');
    const now = this.now();
    b.holdStartedAt = now.toISOString();
    const mod = this.moderator();
    const result =
      mod instanceof RuleBasedProvider
        ? mod.checkSync({ text: b.body, personalization: b.personalization })
        : ({ verdict: 'suspect', categories: [], unavailable: true } as ModerationResult);
    b.moderation = result;
    const outcome = outcomeFor(result);
    if (outcome.trigger === 'auto_violation') {
      this.transition(b, 'auto_violation', { kind: 'system' }, '重新发布命中违规');
    } else if (outcome.trigger === 'auto_pass') {
      b.pendingPublishAt = new Date(now.getTime() + PASS_HOLD_MS).toISOString();
    }
    if (outcome.createTicket) {
      this.createReport(b.id, 'auto_suspect', result.categories[0] ?? 'other', { priority: 30 });
    }
    this.save();
  }

  deleteBlessing(id: string): void {
    const b = this.findOwn(id);
    this.transition(b, 'delete', { kind: 'author', userId: b.authorId }, '作者删除（数据冻结）');
    this.save();
  }

  renew(id: string): void {
    const b = this.findOwn(id);
    this.transition(b, 'renew', { kind: 'author', userId: b.authorId }, '作者续期');
    this.save();
  }

  // ---------- public landing page ----------

  getPublicPage(slugStr: string): PublicPage {
    const b = this.state.blessings.find((x) => x.slug === slugStr);
    if (!b) return { type: 'not_found', placeholderText: PLACEHOLDER_TEXT.not_found };
    const type = placeholderType(b.state, b.expiresAt, this.now());
    if (type !== 'content') {
      return { type, placeholderText: PLACEHOLDER_TEXT[type] };
    }
    const author = this.state.users.find((u) => u.id === b.authorId);
    const p = b.personalization;
    const fromName = p.fromName || author?.nickname || '一位朋友';
    const fromCity = p.fromCity || author?.city || '';
    const fromLine = fromCity ? `来自 ${fromCity} 的 ${fromName}` : `来自 ${fromName}`;
    return {
      type: 'content',
      content: {
        body: [p.prefix, b.body, p.suffix].filter(Boolean).join('\n\n'),
        fromLine,
        toName: p.toName,
        occasion: b.occasion,
        publishedAt: b.publishedAt!,
      },
    };
  }

  // ---------- reports & moderation queue ----------

  private createReport(
    blessingId: string,
    origin: ReportOrigin,
    category: ReportCategory,
    opts: { note?: string; priority?: number; fingerprint?: string } = {},
  ): Report {
    const now = this.now().toISOString();
    const r: Report = {
      id: rid('rpt'),
      blessingId,
      origin,
      category,
      state: 'open',
      priority: opts.priority ?? 50,
      note: opts.note,
      reporterFingerprint: opts.fingerprint,
      count: 1,
      createdAt: now,
      timeline: [{ at: now, text: `工单创建（${origin}）` }],
    };
    this.state.reports.push(r);
    return r;
  }

  report(slugStr: string, category: ReportCategory, note: string, fingerprint: string): void {
    const b = this.state.blessings.find((x) => x.slug === slugStr);
    if (!b) throw new Error('祝福不存在');
    const existing = this.state.reports.find(
      (r) => r.blessingId === b.id && r.origin === 'report' && r.reporterFingerprint === fingerprint,
    );
    if (existing) {
      existing.count += 1;
      existing.timeline.push({ at: this.now().toISOString(), text: '同一来源重复举报，合并计数' });
      this.save();
      return;
    }
    const highRisk = category === 'illegal' || category === 'offensive';
    const r = this.createReport(b.id, 'report', category, {
      note,
      fingerprint,
      priority: highRisk ? 90 : 60,
    });
    if (highRisk && b.state === 'published') {
      this.transition(b, 'report_takedown', { kind: 'system' }, `高危举报即时临时下架（工单 ${r.id}）`);
    }
    this.save();
  }

  moderationQueue(): Report[] {
    return this.state.reports
      .filter((r) => r.state === 'open' || r.state === 'in_review')
      .sort((a, b) => b.priority - a.priority || (a.createdAt < b.createdAt ? -1 : 1));
  }

  blessingById(id: string): Blessing | null {
    return this.state.blessings.find((b) => b.id === id) ?? null;
  }

  resolveReport(
    reportId: string,
    action: 'pass' | 'takedown' | 'request_edit',
    reason: string,
    moderatorId = 'mod_demo',
  ): void {
    const r = this.state.reports.find((x) => x.id === reportId);
    if (!r) throw new Error('工单不存在');
    const b = this.state.blessings.find((x) => x.id === r.blessingId);
    const now = this.now().toISOString();
    const actor: LifecycleActor = { kind: 'moderator', userId: moderatorId };

    if (b) {
      if (action === 'pass') {
        if (b.state === 'verifying') this.transition(b, 'review_pass', actor, reason);
        else if (b.state === 'taken_down') this.transition(b, 'appeal_success', actor, reason);
      } else if (action === 'takedown') {
        if (b.state === 'published') this.transition(b, 'review_takedown', actor, reason);
        else if (b.state === 'verifying') this.transition(b, 'review_reject', actor, reason);
      } else if (action === 'request_edit') {
        if (b.state === 'verifying') this.transition(b, 'review_reject', actor, reason);
      }
      delete (b as { pendingPublishAt?: string }).pendingPublishAt;
    }

    r.state =
      action === 'pass' ? 'resolved_pass' : action === 'takedown' ? 'resolved_takedown' : 'resolved_edit';
    r.resolvedAt = now;
    r.timeline.push({ at: now, text: `审核员处理：${action} — ${reason}` });
    this.save();
  }

  // ---------- streak ----------

  getStreak(): StreakView {
    const u = this.currentUser();
    if (!u) return { total: 0, streak: 0, byDay: [] };
    const data = this.state.streaks[u.id] ?? {};
    const today = localDateFor(this.now(), u.utcOffsetMinutes);
    return {
      total: totalPublished(data),
      streak: currentStreak(data, today),
      byDay: Object.entries(data)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  }
}

export const store = new Store();
