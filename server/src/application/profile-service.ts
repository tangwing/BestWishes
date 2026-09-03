import type { Gender } from '@bestwishes/domain';
import type { ProfileUpdateDto } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import type { ProfileRecord } from '../ports/records';

export interface ProfileView {
  senderName: string;
  regionCity: string;
  lat: number | null;
  lng: number | null;
  gender: Gender | null;
  birthYear: number | null;
  tags: string[];
  locationGranted: boolean;
  featuredByDefault: boolean;
  /** 位置 + 至少能被别人筛到的最小画像是否齐备（群发要求发送者有位置） */
  canBroadcast: boolean;
}

/** 供别人的受众筛选命中的建议标签。 */
export const SUGGESTED_TAGS = [
  '晚睡',
  '考研',
  '带娃',
  '打工人',
  '异乡',
  '养宠物',
  '健身',
  'emo',
  '手艺人',
  '早起',
  '独居',
  '追梦',
];

export function createProfileService(deps: AppDeps) {
  async function view(userId: string): Promise<ProfileView | null> {
    const user = await deps.repos.users.findById(userId);
    if (!user) return null;
    const p = await deps.repos.profiles.get(userId);
    const lat = p?.lat ?? null;
    const lng = p?.lng ?? null;
    return {
      senderName: p?.senderName ?? user.nickname,
      regionCity: p?.regionCity ?? '',
      lat,
      lng,
      gender: p?.gender ?? null,
      birthYear: p?.birthYear ?? null,
      tags: p?.tags ?? [],
      locationGranted: p?.locationGranted ?? false,
      featuredByDefault: p?.featuredByDefault ?? deps.config.featuredDefaultOn,
      canBroadcast: lat !== null && lng !== null,
    };
  }

  return {
    view,
    suggestedTags: (): string[] => [...SUGGESTED_TAGS],

    async update(userId: string, patch: ProfileUpdateDto): Promise<ProfileView | null> {
      const user = await deps.repos.users.findById(userId);
      if (!user) return null;
      const toWrite: Partial<Omit<ProfileRecord, 'userId'>> = {};
      if (patch.senderName !== undefined) toWrite.senderName = patch.senderName || null;
      if (patch.regionCity !== undefined) toWrite.regionCity = patch.regionCity || null;
      if (patch.lat !== undefined) toWrite.lat = patch.lat;
      if (patch.lng !== undefined) toWrite.lng = patch.lng;
      if (patch.gender !== undefined) toWrite.gender = patch.gender;
      if (patch.birthYear !== undefined) toWrite.birthYear = patch.birthYear;
      if (patch.tags !== undefined) toWrite.tags = [...new Set(patch.tags)];
      if (patch.locationGranted !== undefined) toWrite.locationGranted = patch.locationGranted;
      if (patch.featuredByDefault !== undefined) toWrite.featuredByDefault = patch.featuredByDefault;
      await deps.repos.profiles.upsert(userId, toWrite);
      return view(userId);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
