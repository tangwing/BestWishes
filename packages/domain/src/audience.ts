// 受众匹配（纯函数）。对应 specs/blessing-audience。
// 输入是候选人画像 + 筛选条件 + 发送者位置，输出是命中列表（按距离升序）。
// 命中人数上限的判定放在 application 层（要读配置），这里只负责"谁命中"。

import type { AudienceCandidate, AudienceFilter, AudienceMatch, GeoPoint } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 两点间大圆距离（公里）。 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 出生年 → 周岁（按年份差，够 P1 筛选用）。 */
export function ageInYears(birthYear: number, now: Date): number {
  return now.getUTCFullYear() - birthYear;
}

/** 单个候选人是否命中筛选条件。 */
export function matchesAudience(
  candidate: AudienceCandidate,
  filter: AudienceFilter,
  origin: GeoPoint,
  now: Date,
): boolean {
  if (!candidate.point) return false;
  if (haversineKm(origin, candidate.point) > filter.radiusKm) return false;

  if (filter.gender !== 'any' && candidate.gender !== filter.gender) return false;

  if (filter.ageMin !== null || filter.ageMax !== null) {
    if (candidate.birthYear === null) return false;
    const age = ageInYears(candidate.birthYear, now);
    if (filter.ageMin !== null && age < filter.ageMin) return false;
    if (filter.ageMax !== null && age > filter.ageMax) return false;
  }

  if (filter.tags.length > 0) {
    const owned = new Set(candidate.tags);
    if (!filter.tags.some((t) => owned.has(t))) return false;
  }

  return true;
}

/**
 * 解析受众：从候选人集合里挑出命中者，按距发送者的距离升序。
 * excludeUserId 用来排除发送者自己。
 */
export function resolveAudience(
  candidates: readonly AudienceCandidate[],
  filter: AudienceFilter,
  origin: GeoPoint,
  now: Date,
  excludeUserId: string,
): AudienceMatch[] {
  return candidates
    .filter((c) => c.userId !== excludeUserId && c.point !== null)
    .map((c) => ({ candidate: c, distanceKm: haversineKm(origin, c.point as GeoPoint) }))
    .filter((m) => matchesAudience(m.candidate, filter, origin, now))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
