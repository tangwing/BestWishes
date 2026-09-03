import type { AudienceFilter, Occasion } from '@bestwishes/domain';
import type { DraftDto } from '@bestwishes/shared';
import type { AppDeps } from './deps';

export interface DraftView {
  body: string;
  occasion: Occasion;
  audience: AudienceFilter | null;
}

function toAudience(dto: DraftDto['audience']): AudienceFilter | null {
  if (!dto) return null;
  return {
    radiusKm: dto.radiusKm,
    ageMin: dto.ageMin,
    ageMax: dto.ageMax,
    gender: dto.gender,
    tags: [...dto.tags],
  };
}

export function createDraftService(deps: AppDeps) {
  return {
    async get(userId: string): Promise<DraftView | null> {
      const d = await deps.repos.drafts.get(userId);
      if (!d) return null;
      return { body: d.body, occasion: d.occasion, audience: d.audience };
    },

    /** 存草稿。不触发审核、不生成链接、不群发。 */
    async save(userId: string, input: DraftDto): Promise<void> {
      await deps.repos.drafts.save({
        userId,
        body: input.body,
        occasion: input.occasion,
        audience: toAudience(input.audience),
        updatedAt: deps.clock.now().toISOString(),
      });
    },
  };
}

export type DraftService = ReturnType<typeof createDraftService>;
