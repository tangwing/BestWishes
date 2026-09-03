// 持久化记录的形状。领域聚合（Blessing / BlessingEvent 等）在 @bestwishes/domain；
// 这里是那些偏"存储记录"的类型（账户、个人空间、同意记录、工单、通知…）。

import type {
  AudienceFilter,
  Blessing,
  BlessingEvent,
  Gender,
  Occasion,
  ReportCategory,
  ReportOrigin,
  ReportState,
} from '@bestwishes/domain';

export interface UserRecord {
  id: string;
  wxOpenid: string;
  wxUnionid: string | null;
  nickname: string;
  avatarUrl: string | null;
  /** 作者所在地区的 UTC 偏移（分钟）。坚持记录按这个切自然日。P1 默认 +480，后续由地区推导。 */
  utcOffsetMinutes: number;
  source: string;
  createdAt: string;
}

export interface ProfileRecord {
  userId: string;
  senderName: string | null;
  /** 显示用城市 / 省级名，粒度不超过城市。 */
  regionCity: string | null;
  /** 受众距离筛选用的经纬度。两者都有才参与匹配。 */
  lat: number | null;
  lng: number | null;
  gender: Gender | null;
  birthYear: number | null;
  /** 自报标签，用于被别人的受众筛选命中。 */
  tags: string[];
  locationGranted: boolean;
  /** null = 跟随系统默认；true/false = 用户自己设过 */
  featuredByDefault: boolean | null;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  agreementVersion: string;
  scopeDeliver: true;
  scopeFeatured: boolean;
  scopeSynthesis: boolean;
  agreedAt: string;
}

export interface TemplateRecord {
  id: string;
  category: Occasion;
  title: string;
  promptText: string;
  sampleText: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DraftRecord {
  userId: string;
  body: string;
  occasion: Occasion;
  audience: AudienceFilter | null;
  updatedAt: string;
}

/**
 * 祝福记录 = 领域聚合 + 一个调度字段。
 * `holdUntil`：自动通过后、正式对外可见前的等待截止时间（延迟送达）。到点由扫描任务发布。
 * events 也单独存 blessing_events，这里内联方便内存实现。
 */
export type BlessingRecord = Blessing & { holdUntil: string | null };
export type BlessingEventRecord = BlessingEvent & { id: string; blessingId: string };

export interface ReportRecord {
  id: string;
  blessingId: string;
  origin: ReportOrigin;
  category: ReportCategory;
  state: ReportState;
  priority: number;
  note: string | null;
  assignee: string | null;
  resolutionReason: string | null;
  reporterFingerprint: string | null;
  count: number;
  createdAt: string;
  resolvedAt: string | null;
  timeline: { at: string; text: string }[];
}

/** 收件箱条目：某人收到的一条祝福。内容 / 状态读取时从 blessing 拼。 */
export interface InboxItemRecord {
  id: string;
  recipientId: string;
  senderId: string;
  blessingId: string;
  deliveredAt: string;
  readAt: string | null;
}

export type NotificationKind = 'blessing_received';

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: NotificationKind;
  blessingId: string;
  fromUserId: string;
  createdAt: string;
  readAt: string | null;
}
