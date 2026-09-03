// 内存仓储。开发 / 测试 / 演示用。生产换成 PostgreSQL + Drizzle（同一组 ports）。
// 读写都 clone，避免调用方拿到内部引用后改坏数据。

import type { AudienceCandidate, BlessingState } from '@bestwishes/domain';
import type { IdGenerator } from '../../ports/ids';
import type {
  BlessingEventRecord,
  BlessingRecord,
  ConsentRecord,
  DraftRecord,
  InboxItemRecord,
  NotificationRecord,
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
  NotificationRepository,
  ProfileRepository,
  Repositories,
  ReportRepository,
  StreakRepository,
  TemplateRepository,
  UserRepository,
} from '../../ports/repositories';

const clone = <T>(v: T): T => structuredClone(v);

class InMemoryUserRepository implements UserRepository {
  readonly byId = new Map<string, UserRecord>();
  private readonly idByOpenid = new Map<string, string>();
  constructor(private readonly ids: IdGenerator) {}

  findOrCreateByOpenid(
    openid: string,
    create: () => Omit<UserRecord, 'id' | 'createdAt'>,
  ): Promise<UserRecord> {
    const existingId = this.idByOpenid.get(openid);
    if (existingId) {
      const rec = this.byId.get(existingId);
      if (rec) return Promise.resolve(clone(rec));
    }
    const rec: UserRecord = {
      ...create(),
      id: this.ids.next('usr'),
      createdAt: new Date().toISOString(),
    };
    this.byId.set(rec.id, rec);
    this.idByOpenid.set(openid, rec.id);
    return Promise.resolve(clone(rec));
  }

  findById(id: string): Promise<UserRecord | null> {
    const rec = this.byId.get(id);
    return Promise.resolve(rec ? clone(rec) : null);
  }

  findManyByIds(ids: string[]): Promise<UserRecord[]> {
    const set = new Set(ids);
    return Promise.resolve([...this.byId.values()].filter((u) => set.has(u.id)).map(clone));
  }
}

function emptyProfile(userId: string): ProfileRecord {
  return {
    userId,
    senderName: null,
    regionCity: null,
    lat: null,
    lng: null,
    gender: null,
    birthYear: null,
    tags: [],
    locationGranted: false,
    featuredByDefault: null,
    updatedAt: new Date().toISOString(),
  };
}

class InMemoryProfileRepository implements ProfileRepository {
  private readonly byUser = new Map<string, ProfileRecord>();
  constructor(private readonly users: InMemoryUserRepository) {}

  get(userId: string): Promise<ProfileRecord | null> {
    const rec = this.byUser.get(userId);
    return Promise.resolve(rec ? clone(rec) : null);
  }

  upsert(userId: string, patch: Partial<Omit<ProfileRecord, 'userId'>>): Promise<ProfileRecord> {
    const current = this.byUser.get(userId) ?? emptyProfile(userId);
    const next: ProfileRecord = {
      ...current,
      ...patch,
      userId,
      updatedAt: new Date().toISOString(),
    };
    this.byUser.set(userId, next);
    return Promise.resolve(clone(next));
  }

  listCandidates(): Promise<AudienceCandidate[]> {
    const out: AudienceCandidate[] = [];
    for (const p of this.byUser.values()) {
      if (p.lat === null || p.lng === null) continue;
      const user = this.users.byId.get(p.userId);
      out.push({
        userId: p.userId,
        nickname: user?.nickname ?? '一位朋友',
        city: p.regionCity,
        point: { lat: p.lat, lng: p.lng },
        gender: p.gender,
        birthYear: p.birthYear,
        tags: [...p.tags],
      });
    }
    return Promise.resolve(out);
  }
}

class InMemoryConsentRepository implements ConsentRepository {
  private readonly all: ConsentRecord[] = [];

  add(record: ConsentRecord): Promise<void> {
    this.all.push(clone(record));
    return Promise.resolve();
  }

  latestForVersion(userId: string, agreementVersion: string): Promise<ConsentRecord | null> {
    const matches = this.all.filter(
      (c) => c.userId === userId && c.agreementVersion === agreementVersion,
    );
    const last = matches.at(-1);
    return Promise.resolve(last ? clone(last) : null);
  }
}

class InMemoryTemplateRepository implements TemplateRepository {
  constructor(private readonly templates: TemplateRecord[]) {}
  listActive(): Promise<TemplateRecord[]> {
    return Promise.resolve(
      this.templates
        .filter((t) => t.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(clone),
    );
  }
}

class InMemoryDraftRepository implements DraftRepository {
  private readonly byUser = new Map<string, DraftRecord>();
  get(userId: string): Promise<DraftRecord | null> {
    const rec = this.byUser.get(userId);
    return Promise.resolve(rec ? clone(rec) : null);
  }
  save(record: DraftRecord): Promise<void> {
    this.byUser.set(record.userId, clone(record));
    return Promise.resolve();
  }
  clear(userId: string): Promise<void> {
    this.byUser.delete(userId);
    return Promise.resolve();
  }
}

class InMemoryBlessingRepository implements BlessingRepository {
  private readonly byId = new Map<string, BlessingRecord>();
  private readonly idBySlug = new Map<string, string>();

  add(record: BlessingRecord): Promise<void> {
    if (this.idBySlug.has(record.slug)) {
      return Promise.reject(new Error(`slug 冲突: ${record.slug}`));
    }
    this.byId.set(record.id, clone(record));
    this.idBySlug.set(record.slug, record.id);
    return Promise.resolve();
  }

  findById(id: string): Promise<BlessingRecord | null> {
    const rec = this.byId.get(id);
    return Promise.resolve(rec ? clone(rec) : null);
  }

  findBySlug(slug: string): Promise<BlessingRecord | null> {
    const id = this.idBySlug.get(slug);
    if (!id) return Promise.resolve(null);
    const rec = this.byId.get(id);
    return Promise.resolve(rec ? clone(rec) : null);
  }

  save(record: BlessingRecord): Promise<void> {
    this.byId.set(record.id, clone(record));
    this.idBySlug.set(record.slug, record.id);
    return Promise.resolve();
  }

  listByAuthor(authorId: string): Promise<BlessingRecord[]> {
    return Promise.resolve(
      [...this.byId.values()]
        .filter((b) => b.authorId === authorId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(clone),
    );
  }

  listByState(state: BlessingState): Promise<BlessingRecord[]> {
    return Promise.resolve([...this.byId.values()].filter((b) => b.state === state).map(clone));
  }
}

class InMemoryBlessingEventRepository implements BlessingEventRepository {
  private readonly all: BlessingEventRecord[] = [];
  append(event: BlessingEventRecord): Promise<void> {
    this.all.push(clone(event));
    return Promise.resolve();
  }
  listForBlessing(blessingId: string): Promise<BlessingEventRecord[]> {
    return Promise.resolve(this.all.filter((e) => e.blessingId === blessingId).map(clone));
  }
}

class InMemoryReportRepository implements ReportRepository {
  private readonly byId = new Map<string, ReportRecord>();

  add(record: ReportRecord): Promise<void> {
    this.byId.set(record.id, clone(record));
    return Promise.resolve();
  }
  findById(id: string): Promise<ReportRecord | null> {
    const rec = this.byId.get(id);
    return Promise.resolve(rec ? clone(rec) : null);
  }
  save(record: ReportRecord): Promise<void> {
    this.byId.set(record.id, clone(record));
    return Promise.resolve();
  }
  findOpenReportByFingerprint(blessingId: string, fingerprint: string): Promise<ReportRecord | null> {
    const rec = [...this.byId.values()].find(
      (r) =>
        r.blessingId === blessingId &&
        r.origin === 'report' &&
        r.reporterFingerprint === fingerprint &&
        (r.state === 'open' || r.state === 'in_review'),
    );
    return Promise.resolve(rec ? clone(rec) : null);
  }
  findOpenAutoSuspect(blessingId: string): Promise<ReportRecord | null> {
    const rec = [...this.byId.values()].find(
      (r) =>
        r.blessingId === blessingId &&
        r.origin === 'auto_suspect' &&
        (r.state === 'open' || r.state === 'in_review'),
    );
    return Promise.resolve(rec ? clone(rec) : null);
  }
  listOpen(): Promise<ReportRecord[]> {
    return Promise.resolve(
      [...this.byId.values()]
        .filter((r) => r.state === 'open' || r.state === 'in_review')
        .sort((a, b) => b.priority - a.priority || (a.createdAt < b.createdAt ? -1 : 1))
        .map(clone),
    );
  }
}

class InMemoryStreakRepository implements StreakRepository {
  private readonly byUser = new Map<string, Record<string, number>>();
  getDays(userId: string): Promise<Record<string, number>> {
    return Promise.resolve(clone(this.byUser.get(userId) ?? {}));
  }
  setDays(userId: string, days: Record<string, number>): Promise<void> {
    this.byUser.set(userId, clone(days));
    return Promise.resolve();
  }
}

class InMemoryInboxRepository implements InboxRepository {
  private readonly all: InboxItemRecord[] = [];
  listForRecipient(recipientId: string): Promise<InboxItemRecord[]> {
    return Promise.resolve(
      this.all
        .filter((i) => i.recipientId === recipientId)
        .sort((a, b) => (a.deliveredAt < b.deliveredAt ? 1 : -1))
        .map(clone),
    );
  }
  add(record: InboxItemRecord): Promise<void> {
    this.all.push(clone(record));
    return Promise.resolve();
  }
  markAllRead(recipientId: string): Promise<void> {
    const at = new Date().toISOString();
    for (const i of this.all) {
      if (i.recipientId === recipientId && i.readAt === null) i.readAt = at;
    }
    return Promise.resolve();
  }
}

class InMemoryNotificationRepository implements NotificationRepository {
  private readonly all: NotificationRecord[] = [];
  add(record: NotificationRecord): Promise<void> {
    this.all.push(clone(record));
    return Promise.resolve();
  }
  listForUser(userId: string): Promise<NotificationRecord[]> {
    return Promise.resolve(
      this.all
        .filter((n) => n.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(clone),
    );
  }
  unreadCount(userId: string): Promise<number> {
    return Promise.resolve(
      this.all.filter((n) => n.userId === userId && n.readAt === null).length,
    );
  }
  markAllRead(userId: string): Promise<void> {
    const at = new Date().toISOString();
    for (const n of this.all) {
      if (n.userId === userId && n.readAt === null) n.readAt = at;
    }
    return Promise.resolve();
  }
}

export interface InMemoryOptions {
  ids: IdGenerator;
  templates?: TemplateRecord[];
}

export function createInMemoryRepositories(opts: InMemoryOptions): Repositories {
  const users = new InMemoryUserRepository(opts.ids);
  return {
    users,
    profiles: new InMemoryProfileRepository(users),
    consents: new InMemoryConsentRepository(),
    templates: new InMemoryTemplateRepository(opts.templates ?? []),
    drafts: new InMemoryDraftRepository(),
    blessings: new InMemoryBlessingRepository(),
    blessingEvents: new InMemoryBlessingEventRepository(),
    reports: new InMemoryReportRepository(),
    streaks: new InMemoryStreakRepository(),
    inbox: new InMemoryInboxRepository(),
    notifications: new InMemoryNotificationRepository(),
  };
}
