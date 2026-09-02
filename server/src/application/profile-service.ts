import type { ProfileUpdateDto } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import type { ProfileRecord } from '../ports/records';

export interface ProfileView {
  senderName: string;
  regionCity: string;
  locationGranted: boolean;
  featuredByDefault: boolean;
}

export function createProfileService(deps: AppDeps) {
  async function view(userId: string): Promise<ProfileView | null> {
    const user = await deps.repos.users.findById(userId);
    if (!user) return null;
    const p = await deps.repos.profiles.get(userId);
    return {
      senderName: p?.senderName ?? user.nickname,
      regionCity: p?.regionCity ?? '',
      locationGranted: p?.locationGranted ?? false,
      // 用户没设过个人偏好时跟随系统默认
      featuredByDefault: p?.featuredByDefault ?? deps.config.featuredDefaultOn,
    };
  }

  return {
    view,

    async update(userId: string, patch: ProfileUpdateDto): Promise<ProfileView | null> {
      const user = await deps.repos.users.findById(userId);
      if (!user) return null;
      const toWrite: Partial<Omit<ProfileRecord, 'userId'>> = {};
      if (patch.senderName !== undefined) toWrite.senderName = patch.senderName || null;
      if (patch.regionCity !== undefined) toWrite.regionCity = patch.regionCity || null;
      if (patch.locationGranted !== undefined) toWrite.locationGranted = patch.locationGranted;
      if (patch.featuredByDefault !== undefined)
        toWrite.featuredByDefault = patch.featuredByDefault;
      await deps.repos.profiles.upsert(userId, toWrite);
      return view(userId);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
