// P1 领域类型。纯数据，无 IO。将来迁往 server/ 与可能的跨端共享包。

export type BlessingState =
  | 'draft'
  | 'verifying'
  | 'published'
  | 'rejected'
  | 'taken_down'
  | 'withdrawn'
  | 'deleted'
  | 'expired';

export type LifecycleTrigger =
  | 'submit'
  | 'auto_pass'
  | 'auto_violation'
  | 'review_pass'
  | 'review_reject'
  | 'review_takedown'
  | 'report_takedown'
  | 'withdraw'
  | 'republish'
  | 'expire'
  | 'renew'
  | 'edit_resubmit'
  | 'appeal_success'
  | 'delete';

export type LifecycleActor =
  { kind: 'system' } | { kind: 'author'; userId: string } | { kind: 'moderator'; userId: string };

export interface Personalization {
  /** 给谁（称呼）——必填 */
  toName: string;
  /** 我是谁（落款），默认取个人空间设置 */
  fromName?: string;
  /** 所在城市 / 省级，粒度不超过城市，默认取个人空间设置 */
  fromCity?: string;
}

export type Occasion =
  'birthday' | 'festival' | 'encouragement' | 'recovery' | 'remembrance' | 'daily';

export interface BlessingEvent {
  from: BlessingState;
  to: BlessingState;
  trigger: LifecycleTrigger;
  actor: LifecycleActor;
  reason?: string;
  at: string; // ISO
}

export type ModerationCategory =
  | 'politics'
  | 'sexual'
  | 'hate'
  | 'fraud'
  | 'illegal'
  | 'religious_solicitation'
  | 'contact_leak'
  | 'malformed';

export type ModerationVerdict = 'pass' | 'suspect' | 'violation';

export interface ModerationResult {
  verdict: ModerationVerdict;
  categories: ModerationCategory[];
  providerRef?: string;
  /** provider 不可用时为 true，调用方须保守处理 */
  unavailable?: boolean;
}

export interface ModerationInput {
  text: string;
  personalization: Personalization;
}

export interface ModerationProvider {
  readonly name: string;
  check(input: ModerationInput): Promise<ModerationResult>;
}

export type ReportOrigin = 'report' | 'auto_suspect' | 'appeal';

export type ReportState =
  'open' | 'in_review' | 'resolved_pass' | 'resolved_takedown' | 'resolved_edit';

export type ReportCategory =
  'misinformation' | 'offensive' | 'harassment' | 'illegal' | 'other' | ModerationCategory;

export interface Blessing {
  id: string;
  authorId: string;
  body: string;
  personalization: Personalization;
  occasion: Occasion;
  state: BlessingState;
  slug: string;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
  moderation: ModerationResult | null;
  renewCount: number;
  /** 当前是否计入作者的坚持记录。首次 published 时置 true；作者撤回 / 删除 / 平台下架时置 false（链接过期不动）。 */
  countedInStreak: boolean;
  events: BlessingEvent[];
}
