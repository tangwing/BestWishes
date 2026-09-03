// 受众解析。发送者选一个筛选条件，这里算出命中的陌生人是谁、有多少、够不够上限。
// 命中人数上限（config.maxAudienceSize）在这里判定——群发的核心约束。

import {
  ageInYears,
  resolveAudience,
  type AudienceFilter,
  type AudienceMatch,
  type Gender,
  type GeoPoint,
} from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import type { AppDeps } from './deps';

export interface AudiencePreviewRow {
  nickname: string;
  city: string | null;
  distanceKm: number;
  gender: Gender | null;
  age: number | null;
}

export interface AudiencePreview {
  /** 命中总人数（不含发送者自己） */
  count: number;
  /** 群发人数上限 */
  cap: number;
  /** count 是否在上限内（0 也算不可发） */
  canSend: boolean;
  /** 距离最近的前若干位，给发送者一个直观感受 */
  sample: AudiencePreviewRow[];
}

export function createAudienceService(deps: AppDeps) {
  async function originFor(userId: string): Promise<GeoPoint | null> {
    const p = await deps.repos.profiles.get(userId);
    if (p?.lat == null || p.lng == null) return null;
    return { lat: p.lat, lng: p.lng };
  }

  async function resolve(
    userId: string,
    filter: AudienceFilter,
  ): Promise<Result<{ matches: AudienceMatch[]; origin: GeoPoint }>> {
    const origin = await originFor(userId);
    if (!origin) {
      return err(
        appError(
          'location_required',
          'sender has no location',
          '先在个人空间设置你的位置，才能群发',
        ),
      );
    }
    const candidates = await deps.repos.profiles.listCandidates();
    const matches = resolveAudience(candidates, filter, origin, deps.clock.now(), userId);
    return ok({ matches, origin });
  }

  return {
    resolve,

    async preview(userId: string, filter: AudienceFilter): Promise<Result<AudiencePreview>> {
      const r = await resolve(userId, filter);
      if (!r.ok) return r;
      const now = deps.clock.now();
      const cap = deps.config.maxAudienceSize;
      const count = r.value.matches.length;
      return ok({
        count,
        cap,
        canSend: count > 0 && count <= cap,
        sample: r.value.matches.slice(0, 5).map((m) => ({
          nickname: m.candidate.nickname,
          city: m.candidate.city,
          distanceKm: Math.round(m.distanceKm * 10) / 10,
          gender: m.candidate.gender,
          age: m.candidate.birthYear === null ? null : ageInYears(m.candidate.birthYear, now),
        })),
      });
    },

    /** 群发前定格收件人列表。命中 0 或超过上限都拒绝。 */
    async resolveRecipients(userId: string, filter: AudienceFilter): Promise<Result<string[]>> {
      const r = await resolve(userId, filter);
      if (!r.ok) return r;
      const cap = deps.config.maxAudienceSize;
      const matches = r.value.matches;
      if (matches.length === 0) {
        return err(
          appError('audience_empty', 'no match', '这个范围里还没有人。放宽条件或扩大距离试试。'),
        );
      }
      if (matches.length > cap) {
        return err(
          appError(
            'audience_too_large',
            `matched ${String(matches.length)} > cap ${String(cap)}`,
            `命中 ${String(matches.length)} 人，超过一次群发上限 ${String(cap)} 人。缩小范围再试。`,
          ),
        );
      }
      return ok(matches.map((m) => m.candidate.userId));
    },
  };
}

export type AudienceService = ReturnType<typeof createAudienceService>;
