// P1 领域类型。纯数据，无 IO。前后端共享（@bestwishes/domain）。
//
// P1 从「定向送达给认识的人」改成「面向陌生人的按条件群发」：
// 一个人写一段祝福，选一个受众范围（距离 / 年龄 / 性别 / 标签），
// 命中人数不超过上限（配置，测试期 10）才允许群发；命中的人在收件箱收到 + 收到通知。
// 收件人不能对话，只能「回一段祝福」。祝福内容 P1 只做文本，但类型上给音频 / 视频留白。

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
  | 'expire'
  | 'renew'
  | 'edit_resubmit'
  | 'appeal_success'
  | 'delete';

export type LifecycleActor =
  { kind: 'system' } | { kind: 'author'; userId: string } | { kind: 'moderator'; userId: string };

export type Occasion =
  'birthday' | 'festival' | 'encouragement' | 'recovery' | 'remembrance' | 'daily';

/** 用户自报的性别。受众筛选里可选 'any' 表示不限。 */
export type Gender = 'male' | 'female' | 'other';
export type AudienceGender = Gender | 'any';

/** 经纬度。距离筛选的基准。 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * 受众筛选条件。发送者选定一个范围，命中的陌生人会收到这段祝福。
 * tags 为「命中任一即可」；空数组表示不按标签限制。
 */
export interface AudienceFilter {
  /** 以发送者所在位置为圆心的半径（公里） */
  radiusKm: number;
  ageMin: number | null;
  ageMax: number | null;
  gender: AudienceGender;
  tags: string[];
}

/** 参与受众匹配的候选人画像（由 profile 投影而来）。 */
export interface AudienceCandidate {
  userId: string;
  nickname: string;
  city: string | null;
  point: GeoPoint | null;
  gender: Gender | null;
  birthYear: number | null;
  tags: string[];
}

export interface AudienceMatch {
  candidate: AudienceCandidate;
  distanceKm: number;
}

/** 祝福的内容形态。P1 只创作 text；audio / video 是留白（类型在、功能未开）。 */
export type BlessingContentType = 'text' | 'audio' | 'video';

/** 音视频祝福的媒体引用。P1 恒为 null。 */
export interface BlessingMedia {
  url: string;
  durationSec: number;
  /** 音视频的文字转写，供审核与无障碍。 */
  transcript: string | null;
}

/** broadcast = 按受众筛选群发；reply = 对某条收到的祝福回一段（受众恒为对方一人）；
 * wish_response = 回应一条祝福请求（见 WishRequest），受众恒为请求作者一人。 */
export type BlessingScope = 'broadcast' | 'reply' | 'wish_response';

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
  | 'solicitation'
  | 'contact_leak'
  | 'spam'
  | 'low_effort';

export type ModerationVerdict = 'pass' | 'suspect' | 'violation';

export interface ModerationResult {
  verdict: ModerationVerdict;
  categories: ModerationCategory[];
  providerRef?: string;
  /** provider 不可用时为 true，调用方须保守处理 */
  unavailable?: boolean;
}

export interface ModerationInput {
  /** 待审文本。音视频祝福传转写文本。 */
  text: string;
  occasion?: Occasion;
}

export interface ModerationProvider {
  readonly name: string;
  check(input: ModerationInput): Promise<ModerationResult>;
}

export type ReportOrigin = 'report' | 'auto_suspect' | 'appeal';

export type ReportState =
  'open' | 'in_review' | 'resolved_pass' | 'resolved_takedown' | 'resolved_edit';

export type ReportCategory =
  'spam' | 'offensive' | 'harassment' | 'illegal' | 'other' | ModerationCategory;

export interface Blessing {
  id: string;
  authorId: string;
  contentType: BlessingContentType;
  /** 文本内容。非 text 形态时为空串，正文在 media.transcript。 */
  body: string;
  media: BlessingMedia | null;
  occasion: Occasion;
  scope: BlessingScope;
  audience: AudienceFilter;
  /** scope='reply' 时的对象；否则 null。 */
  replyToUserId: string | null;
  /** scope='reply' 时，被回复的那条原始祝福 id；否则 null。用于把回信和原信关联起来。 */
  replyToBlessingId: string | null;
  /** scope='wish_response' 时，回应的那条祝福请求 id；否则 null。 */
  requestId: string | null;
  /** 提交时定格的收件人快照——后加入范围的人不会收到，退出的人也不影响已定格。 */
  recipientIds: string[];
  state: BlessingState;
  slug: string;
  createdAt: string;
  publishedAt: string | null;
  /** 已向收件箱投递并发通知的时间。用于幂等，避免重复扇出。 */
  deliveredAt: string | null;
  expiresAt: string | null;
  moderation: ModerationResult | null;
  renewCount: number;
  /** 当前是否计入作者的坚持记录。首次 published 时置 true；作者撤回 / 删除 / 平台下架时置 false（链接过期不动）。 */
  countedInStreak: boolean;
  events: BlessingEvent[];
}

// ---- P2：祝福请求 + 匹配（见 add-p2-wish-request-audio） ----

/** 祝福请求的生命周期：比 Blessing 简单得多——没有"发布即校验、延迟送达"的语义，
 * 只有"公开 / 撤回 / 删除"三态。撤回是终态，不提供重新发布（同 B-63 的教训）。 */
export type WishRequestState = 'published' | 'withdrawn' | 'deleted';

export type WishRequestTrigger = 'withdraw' | 'delete';

export interface WishRequest {
  id: string;
  authorId: string;
  /** 处境 / 心事描述，必填。 */
  situationText: string;
  /** 希望回应者朗读的具体稿子；可不填，不填则回应者自由发挥。 */
  scriptText: string | null;
  /** 可选标签，用于 wish-request-matching 按标签推荐候选响应人；留空表示不按标签限定，只按距离。 */
  tags: string[];
  state: WishRequestState;
  createdAt: string;
  /** 发布时按标签 / 距离算出的候选响应人快照；此后画像变化不影响它。 */
  recipientCandidateIds: string[];
  moderation: ModerationResult | null;
}

/** 音频打分的输出：多维标签 + 置信度，恒不产出单一可比较分数（vision.md 硬约束）。 */
export type ScoreLabel = 'high' | 'medium' | 'low';
export type CompletenessLabel = 'complete' | 'partial' | 'incomplete';
export type PersonalizationLabel = 'high' | 'moderate' | 'low';

export interface AudioScore {
  blessingId: string;
  /** 有稿子时按对齐覆盖率判定；无稿子时只判"是否构成有效表达"。 */
  completeness: CompletenessLabel;
  /** 基于停顿 / 语速 / 犹豫词的可解释信号工程，非模型黑盒。 */
  focus: ScoreLabel;
  focusConfidence: number;
  /** LLM 评估，带偏差缓解（rubric + 温度0 + 双采样）。 */
  sincerity: ScoreLabel;
  sincerityConfidence: number;
  personalization: PersonalizationLabel;
  /** 挑战式真人校验是否通过；不通过转人工复核，不直接拒绝。 */
  livenessPassed: boolean;
  computedAt: string;
}

/** 打分管线里用于计算 focus 的原始信号（可解释、可单测，不依赖任何网络调用）。 */
export interface AudioSignals {
  /** 音频总时长（秒）。 */
  durationSec: number;
  /** 静音段时长列表（秒），用于识别异常长停顿。 */
  silenceSegmentsSec: number[];
  /** 词级时间戳（供语速稳定性计算），[开始秒, 结束秒, 文字] 的简化三元组。 */
  wordTimestamps: [number, number, string][];
  /** 转写文本，供犹豫词密度检测。 */
  transcript: string;
}

