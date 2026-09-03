// Drizzle schema —— P1 数据模型（见 docs/architecture/p1-architecture.md §7）。
// 约束（非空 / 唯一 / 外键）落库；业务规则不落库（不写触发器 / 存储过程）。

import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  type PgTimestampBuilderInitial,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  AudienceFilter,
  BlessingContentType,
  BlessingMedia,
  BlessingScope,
  BlessingState,
  Gender,
  LifecycleActor,
  ModerationResult,
  ReportCategory,
  ReportOrigin,
  ReportState,
} from '@bestwishes/domain';
import type { NotificationKind } from '../../ports/records';

// 所有时间列存 timestamptz，drizzle 默认读出来是 Date，仓储映射层再转 ISO 字符串。
const ts = (name: string): PgTimestampBuilderInitial<string> =>
  timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  wxOpenid: text('wx_openid').notNull().unique(),
  wxUnionid: text('wx_unionid'),
  nickname: text('nickname').notNull(),
  avatarUrl: text('avatar_url'),
  utcOffsetMinutes: integer('utc_offset_minutes').notNull().default(480),
  source: text('source').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  senderName: text('sender_name'),
  regionCity: text('region_city'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  gender: text('gender').$type<Gender>(),
  birthYear: integer('birth_year'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  locationGranted: boolean('location_granted').notNull().default(false),
  featuredByDefault: boolean('featured_by_default'), // null = 跟随系统默认
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const consents = pgTable('consents', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  agreementVersion: text('agreement_version').notNull(),
  scopeDeliver: boolean('scope_deliver').notNull(),
  scopeFeatured: boolean('scope_featured').notNull(),
  scopeSynthesis: boolean('scope_synthesis').notNull(),
  agreedAt: ts('agreed_at').notNull(),
});

export const templates = pgTable('templates', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  promptText: text('prompt_text').notNull(),
  sampleText: text('sample_text').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const blessingDrafts = pgTable('blessing_drafts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  occasion: text('occasion').notNull(),
  audience: jsonb('audience').$type<AudienceFilter>(),
  updatedAt: ts('updated_at').notNull(),
});

export const blessings = pgTable('blessings', {
  id: text('id').primaryKey(),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contentType: text('content_type').$type<BlessingContentType>().notNull().default('text'),
  body: text('body').notNull(),
  media: jsonb('media').$type<BlessingMedia>(),
  occasion: text('occasion').notNull(),
  scope: text('scope').$type<BlessingScope>().notNull().default('broadcast'),
  audience: jsonb('audience').$type<AudienceFilter>().notNull(),
  replyToUserId: text('reply_to_user_id'),
  recipientIds: jsonb('recipient_ids').$type<string[]>().notNull().default([]),
  state: text('state').$type<BlessingState>().notNull(),
  publicSlug: text('public_slug').notNull().unique(),
  createdAt: ts('created_at').notNull(),
  publishedAt: ts('published_at'),
  deliveredAt: ts('delivered_at'),
  expiresAt: ts('expires_at'),
  holdUntil: ts('hold_until'),
  moderation: jsonb('moderation').$type<ModerationResult>(),
  renewCount: integer('renew_count').notNull().default(0),
  countedInStreak: boolean('counted_in_streak').notNull().default(false),
});

export const blessingEvents = pgTable('blessing_events', {
  id: text('id').primaryKey(),
  blessingId: text('blessing_id')
    .notNull()
    .references(() => blessings.id, { onDelete: 'cascade' }),
  fromState: text('from_state').$type<BlessingState>().notNull(),
  toState: text('to_state').$type<BlessingState>().notNull(),
  trigger: text('trigger').notNull(),
  actor: jsonb('actor').$type<LifecycleActor>().notNull(),
  reason: text('reason'),
  at: ts('at').notNull(),
});

export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  blessingId: text('blessing_id')
    .notNull()
    .references(() => blessings.id, { onDelete: 'cascade' }),
  origin: text('origin').$type<ReportOrigin>().notNull(),
  category: text('category').$type<ReportCategory>().notNull(),
  state: text('state').$type<ReportState>().notNull(),
  priority: integer('priority').notNull(),
  note: text('note'),
  assignee: text('assignee'),
  resolutionReason: text('resolution_reason'),
  reporterFingerprint: text('reporter_fingerprint'),
  count: integer('count').notNull().default(1),
  createdAt: ts('created_at').notNull(),
  resolvedAt: ts('resolved_at'),
  timeline: jsonb('timeline').$type<{ at: string; text: string }[]>().notNull().default([]),
});

export const streakDays = pgTable(
  'streak_days',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    publishedCount: integer('published_count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })],
);

export const inboxItems = pgTable('inbox_items', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  blessingId: text('blessing_id')
    .notNull()
    .references(() => blessings.id, { onDelete: 'cascade' }),
  deliveredAt: ts('delivered_at').notNull(),
  readAt: ts('read_at'),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<NotificationKind>().notNull(),
  blessingId: text('blessing_id')
    .notNull()
    .references(() => blessings.id, { onDelete: 'cascade' }),
  fromUserId: text('from_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull(),
  readAt: ts('read_at'),
});
