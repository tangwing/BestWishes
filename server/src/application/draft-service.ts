import type { Occasion, Personalization } from '@bestwishes/domain';
import type { PersonalizationDto } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import { toPersonalization } from './personalization';

export interface DraftInput {
  body: string;
  occasion: Occasion;
  personalization: PersonalizationDto;
}

export interface DraftView {
  body: string;
  occasion: Occasion;
  personalization: Personalization;
}

export function createDraftService(deps: AppDeps) {
  return {
    async get(userId: string): Promise<DraftView | null> {
      const d = await deps.repos.drafts.get(userId);
      if (!d) return null;
      return { body: d.body, occasion: d.occasion, personalization: d.personalization };
    },

    /** 存草稿。不触发审核、不生成链接。 */
    async save(userId: string, input: DraftInput): Promise<void> {
      await deps.repos.drafts.save({
        userId,
        body: input.body,
        occasion: input.occasion,
        personalization: toPersonalization(input.personalization),
        updatedAt: deps.clock.now().toISOString(),
      });
    },
  };
}

export type DraftService = ReturnType<typeof createDraftService>;
