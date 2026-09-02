import {
  outcomeFor,
  placeholderType,
  PLACEHOLDER_TEXT,
  type Occasion,
  type Personalization,
  type PlaceholderType,
} from '@bestwishes/domain';
import {
  AppException,
  appError,
  err,
  ok,
  type PersonalizationDto,
  type Result,
} from '@bestwishes/shared';
import { AGREEMENT_VERSION, type AppDeps } from './deps';
import { transitionAndPersist } from './blessing-write';
import type { BlessingRecord } from '../ports/records';

export interface SubmitInput {
  body: string;
  occasion: Occasion;
  personalization: PersonalizationDto;
}

export interface SubmittedBlessing {
  id: string;
  slug: string;
  state: string;
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

export interface OutboxItem {
  id: string;
  slug: string;
  state: string;
  occasion: Occasion;
  toName: string;
  bodyPreview: string;
  renewCount: number;
  createdAt: string;
}

function charCount(s: string): number {
  return Array.from(s.trim()).length;
}

export function createBlessingService(deps: AppDeps) {
  async function requireUser(userId: string) {
    const u = await deps.repos.users.findById(userId);
    if (!u) throw new AppException('unauthorized', 'no session');
    return u;
  }

  return {
    async submit(userId: string, input: SubmitInput): Promise<Result<SubmittedBlessing>> {
      const user = await requireUser(userId);

      const consent = await deps.repos.consents.latestForVersion(userId, AGREEMENT_VERSION);
      if (!consent) {
        return err(appError('consent_required', 'no consent', '请先同意《用户内容与授权协议》'));
      }

      if (!input.personalization.toName.trim()) {
        return err(appError('validation_failed', 'toName required', '请填写「给谁」'));
      }

      const len = charCount(input.body);
      if (len < deps.config.bodyMinLen) {
        return err(
          appError(
            'validation_failed',
            'body too short',
            `再多写一点吧（至少 ${String(deps.config.bodyMinLen)} 字）`,
          ),
        );
      }
      if (len > deps.config.bodyMaxLen) {
        return err(
          appError(
            'validation_failed',
            'body too long',
            `有点长了，精简到 ${String(deps.config.bodyMaxLen)} 字以内`,
          ),
        );
      }

      const profile = await deps.repos.profiles.get(userId);
      const personalization: Personalization = { toName: input.personalization.toName.trim() };
      const fromName =
        input.personalization.fromName?.trim() || profile?.senderName || user.nickname;
      if (fromName) personalization.fromName = fromName;
      const fromCity = input.personalization.fromCity?.trim() || profile?.regionCity || '';
      if (fromCity) personalization.fromCity = fromCity;

      const now = deps.clock.now().toISOString();
      const draftRecord: BlessingRecord = {
        id: deps.ids.next('bls'),
        authorId: userId,
        body: input.body.trim(),
        personalization,
        occasion: input.occasion,
        state: 'draft',
        slug: deps.slugs.next(),
        createdAt: now,
        publishedAt: null,
        expiresAt: null,
        moderation: null,
        renewCount: 0,
        countedInStreak: false,
        holdUntil: null,
        events: [],
      };

      const submitted = await transitionAndPersist(
        deps,
        draftRecord,
        'submit',
        { kind: 'author', userId },
        '作者提交',
      );
      if (!submitted.ok) return submitted;
      await deps.repos.drafts.clear(userId);

      // 同步跑规则审核（对标 architecture D4）。真实云 API 接入后改异步 + 回调，前端已为占位留好位。
      const moderation = await deps.moderation.check({ text: draftRecord.body, personalization });
      const outcome = outcomeFor(moderation);

      let current = submitted.value;
      current = { ...current, moderation };
      await deps.repos.blessings.save(current);

      if (outcome.trigger === 'auto_violation') {
        const rejected = await transitionAndPersist(
          deps,
          current,
          'auto_violation',
          { kind: 'system' },
          `命中：${moderation.categories.join(',')}`,
        );
        if (rejected.ok) current = rejected.value;
      } else if (outcome.trigger === 'auto_pass') {
        const holdUntil = new Date(
          deps.clock.now().getTime() + deps.config.holdSeconds * 1000,
        ).toISOString();
        current = { ...current, holdUntil };
        await deps.repos.blessings.save(current);
      }

      if (outcome.createTicket) {
        await deps.repos.reports.add({
          id: deps.ids.next('rpt'),
          blessingId: current.id,
          origin: 'auto_suspect',
          category: moderation.categories[0] ?? 'other',
          state: 'open',
          priority: 30,
          note: outcome.note,
          assignee: null,
          resolutionReason: null,
          reporterFingerprint: null,
          count: 1,
          createdAt: now,
          resolvedAt: null,
          timeline: [{ at: now, text: `工单创建（auto_suspect）` }],
        });
      }

      return ok({ id: current.id, slug: current.slug, state: current.state });
    },

    async getPublicPage(slug: string): Promise<PublicPage> {
      const b = await deps.repos.blessings.findBySlug(slug);
      if (!b) return { type: 'not_found', placeholderText: PLACEHOLDER_TEXT.not_found };
      const now = deps.clock.now();
      const type = placeholderType(b.state, b.expiresAt, now);
      if (type !== 'content') {
        return { type, placeholderText: PLACEHOLDER_TEXT[type] };
      }
      const author = await deps.repos.users.findById(b.authorId);
      const fromName = b.personalization.fromName ?? author?.nickname ?? '一位朋友';
      const fromCity = b.personalization.fromCity ?? '';
      return {
        type: 'content',
        content: {
          body: b.body,
          fromLine: fromCity ? `来自 ${fromCity} 的 ${fromName}` : `来自 ${fromName}`,
          toName: b.personalization.toName,
          occasion: b.occasion,
          publishedAt: b.publishedAt ?? b.createdAt,
        },
      };
    },

    async outbox(userId: string): Promise<OutboxItem[]> {
      const list = await deps.repos.blessings.listByAuthor(userId);
      return list
        .filter((b) => b.state !== 'deleted')
        .map((b) => ({
          id: b.id,
          slug: b.slug,
          state: b.state,
          occasion: b.occasion,
          toName: b.personalization.toName,
          bodyPreview: b.body.slice(0, 40),
          renewCount: b.renewCount,
          createdAt: b.createdAt,
        }));
    },

    async inbox(userId: string): Promise<{ items: never[]; note: string }> {
      await requireUser(userId);
      return {
        items: [],
        note: '你写给别人的祝福通过链接送达；站内收发要等主动赠送和祝福请求上线。',
      };
    },

    withdraw: (userId: string, id: string) =>
      manage(deps, userId, id, 'withdraw', '作者撤回', true),
    delete: (userId: string, id: string) => manage(deps, userId, id, 'delete', '作者删除', false),
    renew: (userId: string, id: string) => manage(deps, userId, id, 'renew', '作者续期', false),

    async republish(userId: string, id: string): Promise<Result<{ state: string }>> {
      const owned = await findOwn(deps, userId, id);
      if (!owned.ok) return owned;
      const back = await transitionAndPersist(
        deps,
        owned.value,
        'republish',
        { kind: 'author', userId },
        '作者重新发布',
        null,
      );
      if (!back.ok) return back;
      const moderation = await deps.moderation.check({
        text: back.value.body,
        personalization: back.value.personalization,
      });
      const outcome = outcomeFor(moderation);
      let current: BlessingRecord = { ...back.value, moderation };
      await deps.repos.blessings.save(current);
      if (outcome.trigger === 'auto_violation') {
        const rej = await transitionAndPersist(
          deps,
          current,
          'auto_violation',
          { kind: 'system' },
          '重新发布命中违规',
        );
        if (rej.ok) current = rej.value;
      } else if (outcome.trigger === 'auto_pass') {
        current = {
          ...current,
          holdUntil: new Date(
            deps.clock.now().getTime() + deps.config.holdSeconds * 1000,
          ).toISOString(),
        };
        await deps.repos.blessings.save(current);
      }
      return ok({ state: current.state });
    },
  };
}

async function findOwn(deps: AppDeps, userId: string, id: string): Promise<Result<BlessingRecord>> {
  const b = await deps.repos.blessings.findById(id);
  if (b?.authorId !== userId) {
    return err(appError('not_found', 'blessing not found', '找不到这份祝福'));
  }
  return ok(b);
}

async function manage(
  deps: AppDeps,
  userId: string,
  id: string,
  trigger: 'withdraw' | 'delete' | 'renew',
  reason: string,
  clearHold: boolean,
): Promise<Result<{ state: string }>> {
  const owned = await findOwn(deps, userId, id);
  if (!owned.ok) return owned;
  const r = await transitionAndPersist(
    deps,
    owned.value,
    trigger,
    { kind: 'author', userId },
    reason,
    clearHold ? null : owned.value.holdUntil,
  );
  if (!r.ok) return r;

  // 校验期取消：关掉关联的自动疑似工单
  if (trigger === 'withdraw' && owned.value.state === 'verifying') {
    const ticket = await deps.repos.reports.findOpenAutoSuspect(id);
    if (ticket) {
      const at = deps.clock.now().toISOString();
      await deps.repos.reports.save({
        ...ticket,
        state: 'resolved_pass',
        resolvedAt: at,
        timeline: [...ticket.timeline, { at, text: '作者在校验期撤回，工单关闭' }],
      });
    }
  }

  return ok({ state: r.value.state });
}

export type BlessingService = ReturnType<typeof createBlessingService>;
