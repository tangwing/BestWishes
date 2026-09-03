// PostgreSQL 仓储实现（Drizzle + PGlite）。和内存实现是同一组 ports，
// application 层不感知用的是哪个。祝福事件单独存 blessing_events，读祝福时再拼回 events 数组。

import type { BlessingState } from '@bestwishes/domain';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { IdGenerator } from '../../ports/ids';
import type {
  BlessingEventRecord,
  BlessingRecord,
  ConsentRecord,
  DraftRecord,
  InboxItemRecord,
  ProfileRecord,
  ReportRecord,
  TemplateRecord,
  UserRecord,
} from '../../ports/records';
import type {
  BlessingEventRepository,
  BlessingRepository,
  ConsentRepository,
  DraftRepository,
  InboxRepository,
  ProfileRepository,
  Repositories,
  ReportRepository,
  StreakRepository,
  TemplateRepository,
  UserRepository,
} from '../../ports/repositories';
import type { Db } from '../db/client';
import * as t from '../db/schema';

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
const OPEN_REPORT_STATES = ['open', 'in_review'] as const;

type UserRow = typeof t.users.$inferSelect;
type BlessingRow = typeof t.blessings.$inferSelect;
type EventRow = typeof t.blessingEvents.$inferSelect;
type ReportRow = typeof t.reports.$inferSelect;

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    wxOpenid: row.wxOpenid,
    wxUnionid: row.wxUnionid,
    nickname: row.nickname,
    avatarUrl: row.avatarUrl,
    utcOffsetMinutes: row.utcOffsetMinutes,
    source: row.source,
    createdAt: iso(row.createdAt),
  };
}

function toEvent(row: EventRow): BlessingEventRecord {
  return {
    id: row.id,
    blessingId: row.blessingId,
    from: row.fromState,
    to: row.toState,
    trigger: row.trigger as BlessingEventRecord['trigger'],
    actor: row.actor,
    ...(row.reason === null ? {} : { reason: row.reason }),
    at: iso(row.at),
  };
}

function toBlessing(row: BlessingRow, events: BlessingEventRecord[]): BlessingRecord {
  return {
    id: row.id,
    authorId: row.authorId,
    body: row.body,
    personalization: row.personalization,
    occasion: row.occasion as BlessingRecord['occasion'],
    state: row.state,
    slug: row.publicSlug,
    createdAt: iso(row.createdAt),
    publishedAt: isoOrNull(row.publishedAt),
    expiresAt: isoOrNull(row.expiresAt),
    moderation: row.moderation,
    renewCount: row.renewCount,
    countedInStreak: row.countedInStreak,
    holdUntil: isoOrNull(row.holdUntil),
    events: events.map(({ id: _id, blessingId: _bid, ...e }) => e),
  };
}

function blessingValues(r: BlessingRecord): typeof t.blessings.$inferInsert {
  return {
    id: r.id,
    authorId: r.authorId,
    body: r.body,
    personalization: r.personalization,
    occasion: r.occasion,
    state: r.state,
    publicSlug: r.slug,
    createdAt: new Date(r.createdAt),
    publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
    holdUntil: r.holdUntil ? new Date(r.holdUntil) : null,
    moderation: r.moderation,
    renewCount: r.renewCount,
    countedInStreak: r.countedInStreak,
  };
}

function toReport(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    blessingId: row.blessingId,
    origin: row.origin,
    category: row.category,
    state: row.state,
    priority: row.priority,
    note: row.note,
    assignee: row.assignee,
    resolutionReason: row.resolutionReason,
    reporterFingerprint: row.reporterFingerprint,
    count: row.count,
    createdAt: iso(row.createdAt),
    resolvedAt: isoOrNull(row.resolvedAt),
    timeline: row.timeline,
  };
}

function reportValues(r: ReportRecord): typeof t.reports.$inferInsert {
  return {
    id: r.id,
    blessingId: r.blessingId,
    origin: r.origin,
    category: r.category,
    state: r.state,
    priority: r.priority,
    note: r.note,
    assignee: r.assignee,
    resolutionReason: r.resolutionReason,
    reporterFingerprint: r.reporterFingerprint,
    count: r.count,
    createdAt: new Date(r.createdAt),
    resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
    timeline: r.timeline,
  };
}

class PgUserRepository implements UserRepository {
  constructor(
    private readonly db: Db,
    private readonly ids: IdGenerator,
  ) {}

  async findOrCreateByOpenid(
    openid: string,
    create: () => Omit<UserRecord, 'id' | 'createdAt'>,
  ): Promise<UserRecord> {
    const existing = await this.db
      .select()
      .from(t.users)
      .where(eq(t.users.wxOpenid, openid))
      .limit(1);
    const found = existing[0];
    if (found) return toUser(found);

    const values: typeof t.users.$inferInsert = {
      ...create(),
      id: this.ids.next('usr'),
      createdAt: new Date(),
    };
    const inserted = await this.db.insert(t.users).values(values).returning();
    // 极小概率并发插入撞 openid 唯一约束——重查一次。
    const row = inserted[0] ?? (await this.byOpenid(openid));
    if (!row) throw new Error(`建用户失败: ${openid}`);
    return toUser(row);
  }

  private async byOpenid(openid: string): Promise<UserRow | undefined> {
    const rows = await this.db.select().from(t.users).where(eq(t.users.wxOpenid, openid)).limit(1);
    return rows[0];
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(t.users).where(eq(t.users.id, id)).limit(1);
    const row = rows[0];
    return row ? toUser(row) : null;
  }
}

class PgProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<ProfileRecord | null> {
    const rows = await this.db
      .select()
      .from(t.userProfiles)
      .where(eq(t.userProfiles.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      senderName: row.senderName,
      regionCity: row.regionCity,
      locationGranted: row.locationGranted,
      featuredByDefault: row.featuredByDefault,
      updatedAt: iso(row.updatedAt),
    };
  }

  async upsert(
    userId: string,
    patch: Partial<Omit<ProfileRecord, 'userId'>>,
  ): Promise<ProfileRecord> {
    const current = (await this.get(userId)) ?? {
      userId,
      senderName: null,
      regionCity: null,
      locationGranted: false,
      featuredByDefault: null,
      updatedAt: new Date().toISOString(),
    };
    const next: ProfileRecord = {
      ...current,
      ...patch,
      userId,
      updatedAt: new Date().toISOString(),
    };
    const values: typeof t.userProfiles.$inferInsert = {
      userId,
      senderName: next.senderName,
      regionCity: next.regionCity,
      locationGranted: next.locationGranted,
      featuredByDefault: next.featuredByDefault,
      updatedAt: new Date(next.updatedAt),
    };
    await this.db
      .insert(t.userProfiles)
      .values(values)
      .onConflictDoUpdate({ target: t.userProfiles.userId, set: values });
    return next;
  }
}

class PgConsentRepository implements ConsentRepository {
  constructor(private readonly db: Db) {}

  async add(record: ConsentRecord): Promise<void> {
    await this.db.insert(t.consents).values({
      id: record.id,
      userId: record.userId,
      agreementVersion: record.agreementVersion,
      scopeDeliver: record.scopeDeliver,
      scopeFeatured: record.scopeFeatured,
      scopeSynthesis: record.scopeSynthesis,
      agreedAt: new Date(record.agreedAt),
    });
  }

  async latestForVersion(userId: string, agreementVersion: string): Promise<ConsentRecord | null> {
    const rows = await this.db
      .select()
      .from(t.consents)
      .where(and(eq(t.consents.userId, userId), eq(t.consents.agreementVersion, agreementVersion)))
      .orderBy(desc(t.consents.agreedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      agreementVersion: row.agreementVersion,
      scopeDeliver: row.scopeDeliver as true,
      scopeFeatured: row.scopeFeatured,
      scopeSynthesis: row.scopeSynthesis,
      agreedAt: iso(row.agreedAt),
    };
  }
}

class PgTemplateRepository implements TemplateRepository {
  constructor(private readonly db: Db) {}

  async listActive(): Promise<TemplateRecord[]> {
    const rows = await this.db
      .select()
      .from(t.templates)
      .where(eq(t.templates.isActive, true))
      .orderBy(asc(t.templates.sortOrder));
    return rows.map((row) => ({
      id: row.id,
      category: row.category as TemplateRecord['category'],
      title: row.title,
      promptText: row.promptText,
      sampleText: row.sampleText,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    }));
  }
}

class PgDraftRepository implements DraftRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<DraftRecord | null> {
    const rows = await this.db
      .select()
      .from(t.blessingDrafts)
      .where(eq(t.blessingDrafts.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      body: row.body,
      personalization: row.personalization,
      occasion: row.occasion as DraftRecord['occasion'],
      updatedAt: iso(row.updatedAt),
    };
  }

  async save(record: DraftRecord): Promise<void> {
    const values: typeof t.blessingDrafts.$inferInsert = {
      userId: record.userId,
      body: record.body,
      personalization: record.personalization,
      occasion: record.occasion,
      updatedAt: new Date(record.updatedAt),
    };
    await this.db
      .insert(t.blessingDrafts)
      .values(values)
      .onConflictDoUpdate({ target: t.blessingDrafts.userId, set: values });
  }

  async clear(userId: string): Promise<void> {
    await this.db.delete(t.blessingDrafts).where(eq(t.blessingDrafts.userId, userId));
  }
}

class PgBlessingRepository implements BlessingRepository {
  constructor(private readonly db: Db) {}

  private async loadEvents(blessingId: string): Promise<BlessingEventRecord[]> {
    const rows = await this.db
      .select()
      .from(t.blessingEvents)
      .where(eq(t.blessingEvents.blessingId, blessingId))
      .orderBy(asc(t.blessingEvents.at));
    return rows.map(toEvent);
  }

  async add(record: BlessingRecord): Promise<void> {
    const clash = await this.db
      .select({ id: t.blessings.id })
      .from(t.blessings)
      .where(eq(t.blessings.publicSlug, record.slug))
      .limit(1);
    if (clash[0]) throw new Error(`slug 冲突: ${record.slug}`);
    await this.db.insert(t.blessings).values(blessingValues(record));
  }

  async findById(id: string): Promise<BlessingRecord | null> {
    const rows = await this.db.select().from(t.blessings).where(eq(t.blessings.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return toBlessing(row, await this.loadEvents(row.id));
  }

  async findBySlug(slug: string): Promise<BlessingRecord | null> {
    const rows = await this.db
      .select()
      .from(t.blessings)
      .where(eq(t.blessings.publicSlug, slug))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return toBlessing(row, await this.loadEvents(row.id));
  }

  async save(record: BlessingRecord): Promise<void> {
    const values = blessingValues(record);
    await this.db
      .insert(t.blessings)
      .values(values)
      .onConflictDoUpdate({ target: t.blessings.id, set: values });
  }

  async listByAuthor(authorId: string): Promise<BlessingRecord[]> {
    const rows = await this.db
      .select()
      .from(t.blessings)
      .where(eq(t.blessings.authorId, authorId))
      .orderBy(desc(t.blessings.createdAt));
    return Promise.all(rows.map(async (row) => toBlessing(row, await this.loadEvents(row.id))));
  }

  async listByState(state: BlessingState): Promise<BlessingRecord[]> {
    const rows = await this.db.select().from(t.blessings).where(eq(t.blessings.state, state));
    return Promise.all(rows.map(async (row) => toBlessing(row, await this.loadEvents(row.id))));
  }
}

class PgBlessingEventRepository implements BlessingEventRepository {
  constructor(private readonly db: Db) {}

  async append(event: BlessingEventRecord): Promise<void> {
    await this.db.insert(t.blessingEvents).values({
      id: event.id,
      blessingId: event.blessingId,
      fromState: event.from,
      toState: event.to,
      trigger: event.trigger,
      actor: event.actor,
      reason: event.reason ?? null,
      at: new Date(event.at),
    });
  }

  async listForBlessing(blessingId: string): Promise<BlessingEventRecord[]> {
    const rows = await this.db
      .select()
      .from(t.blessingEvents)
      .where(eq(t.blessingEvents.blessingId, blessingId))
      .orderBy(asc(t.blessingEvents.at));
    return rows.map(toEvent);
  }
}

class PgReportRepository implements ReportRepository {
  constructor(private readonly db: Db) {}

  async add(record: ReportRecord): Promise<void> {
    await this.db.insert(t.reports).values(reportValues(record));
  }

  async findById(id: string): Promise<ReportRecord | null> {
    const rows = await this.db.select().from(t.reports).where(eq(t.reports.id, id)).limit(1);
    const row = rows[0];
    return row ? toReport(row) : null;
  }

  async save(record: ReportRecord): Promise<void> {
    const values = reportValues(record);
    await this.db
      .insert(t.reports)
      .values(values)
      .onConflictDoUpdate({ target: t.reports.id, set: values });
  }

  async findOpenReportByFingerprint(
    blessingId: string,
    fingerprint: string,
  ): Promise<ReportRecord | null> {
    const rows = await this.db
      .select()
      .from(t.reports)
      .where(
        and(
          eq(t.reports.blessingId, blessingId),
          eq(t.reports.origin, 'report'),
          eq(t.reports.reporterFingerprint, fingerprint),
          inArray(t.reports.state, [...OPEN_REPORT_STATES]),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? toReport(row) : null;
  }

  async findOpenAutoSuspect(blessingId: string): Promise<ReportRecord | null> {
    const rows = await this.db
      .select()
      .from(t.reports)
      .where(
        and(
          eq(t.reports.blessingId, blessingId),
          eq(t.reports.origin, 'auto_suspect'),
          inArray(t.reports.state, [...OPEN_REPORT_STATES]),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? toReport(row) : null;
  }

  async listOpen(): Promise<ReportRecord[]> {
    const rows = await this.db
      .select()
      .from(t.reports)
      .where(inArray(t.reports.state, [...OPEN_REPORT_STATES]))
      .orderBy(desc(t.reports.priority), asc(t.reports.createdAt));
    return rows.map(toReport);
  }
}

class PgStreakRepository implements StreakRepository {
  constructor(private readonly db: Db) {}

  async getDays(userId: string): Promise<Record<string, number>> {
    const rows = await this.db.select().from(t.streakDays).where(eq(t.streakDays.userId, userId));
    const out: Record<string, number> = {};
    for (const row of rows) out[row.localDate] = row.publishedCount;
    return out;
  }

  async setDays(userId: string, days: Record<string, number>): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.streakDays).where(eq(t.streakDays.userId, userId));
      const entries = Object.entries(days);
      if (entries.length === 0) return;
      await tx
        .insert(t.streakDays)
        .values(
          entries.map(([localDate, publishedCount]) => ({ userId, localDate, publishedCount })),
        );
    });
  }
}

class PgInboxRepository implements InboxRepository {
  constructor(private readonly db: Db) {}

  async listForRecipient(recipientId: string): Promise<InboxItemRecord[]> {
    const rows = await this.db
      .select()
      .from(t.inboxItems)
      .where(eq(t.inboxItems.recipientId, recipientId));
    return rows.map((row) => ({
      id: row.id,
      recipientId: row.recipientId,
      senderId: row.senderId,
      blessingId: row.blessingId,
      deliveredAt: iso(row.deliveredAt),
    }));
  }

  async add(record: InboxItemRecord): Promise<void> {
    await this.db.insert(t.inboxItems).values({
      id: record.id,
      recipientId: record.recipientId,
      senderId: record.senderId,
      blessingId: record.blessingId,
      deliveredAt: new Date(record.deliveredAt),
    });
  }
}

/** 把范本种子写进 templates 表（幂等，按 id upsert）。main.ts 和集成测试都用。 */
export async function seedPgTemplates(db: Db, templates: TemplateRecord[]): Promise<void> {
  if (templates.length === 0) return;
  await db
    .insert(t.templates)
    .values(
      templates.map((tpl) => ({
        id: tpl.id,
        category: tpl.category,
        title: tpl.title,
        promptText: tpl.promptText,
        sampleText: tpl.sampleText,
        isActive: tpl.isActive,
        sortOrder: tpl.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: t.templates.id });
}

export function createPgRepositories(db: Db, ids: IdGenerator): Repositories {
  return {
    users: new PgUserRepository(db, ids),
    profiles: new PgProfileRepository(db),
    consents: new PgConsentRepository(db),
    templates: new PgTemplateRepository(db),
    drafts: new PgDraftRepository(db),
    blessings: new PgBlessingRepository(db),
    blessingEvents: new PgBlessingEventRepository(db),
    reports: new PgReportRepository(db),
    streaks: new PgStreakRepository(db),
    inbox: new PgInboxRepository(db),
  };
}
