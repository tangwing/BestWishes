// 仓储接口。application 层依赖这些，不依赖具体实现（内存 / PostgreSQL）。

import type { BlessingState } from '@bestwishes/domain';
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
} from './records';

export interface UserRepository {
  /** 按 openid 找已有账户，没有则用工厂建一个（openid 幂等）。 */
  findOrCreateByOpenid(
    openid: string,
    create: () => Omit<UserRecord, 'id' | 'createdAt'>,
  ): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface ProfileRepository {
  get(userId: string): Promise<ProfileRecord | null>;
  upsert(userId: string, patch: Partial<Omit<ProfileRecord, 'userId'>>): Promise<ProfileRecord>;
}

export interface ConsentRepository {
  add(record: ConsentRecord): Promise<void>;
  latestForVersion(userId: string, agreementVersion: string): Promise<ConsentRecord | null>;
}

export interface TemplateRepository {
  listActive(): Promise<TemplateRecord[]>;
}

export interface DraftRepository {
  get(userId: string): Promise<DraftRecord | null>;
  save(record: DraftRecord): Promise<void>;
  clear(userId: string): Promise<void>;
}

export interface BlessingRepository {
  add(record: BlessingRecord): Promise<void>;
  findById(id: string): Promise<BlessingRecord | null>;
  findBySlug(slug: string): Promise<BlessingRecord | null>;
  save(record: BlessingRecord): Promise<void>;
  listByAuthor(authorId: string): Promise<BlessingRecord[]>;
  /** 到期扫描 / hold 超时扫描用 */
  listByState(state: BlessingState): Promise<BlessingRecord[]>;
}

export interface BlessingEventRepository {
  append(event: BlessingEventRecord): Promise<void>;
  listForBlessing(blessingId: string): Promise<BlessingEventRecord[]>;
}

export interface ReportRepository {
  add(record: ReportRecord): Promise<void>;
  findById(id: string): Promise<ReportRecord | null>;
  save(record: ReportRecord): Promise<void>;
  findOpenReportByFingerprint(
    blessingId: string,
    fingerprint: string,
  ): Promise<ReportRecord | null>;
  findOpenAutoSuspect(blessingId: string): Promise<ReportRecord | null>;
  listOpen(): Promise<ReportRecord[]>;
}

export interface StreakRepository {
  /** 某作者按自然日的发布净计数。 */
  getDays(userId: string): Promise<Record<string, number>>;
  setDays(userId: string, days: Record<string, number>): Promise<void>;
}

export interface InboxRepository {
  listForRecipient(recipientId: string): Promise<InboxItemRecord[]>;
  add(record: InboxItemRecord): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  profiles: ProfileRepository;
  consents: ConsentRepository;
  templates: TemplateRepository;
  drafts: DraftRepository;
  blessings: BlessingRepository;
  blessingEvents: BlessingEventRepository;
  reports: ReportRepository;
  streaks: StreakRepository;
  inbox: InboxRepository;
}
