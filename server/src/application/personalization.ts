import type { Personalization } from '@bestwishes/domain';
import type { PersonalizationDto } from '@bestwishes/shared';

/** Zod 的 .optional() 会给 `T | undefined`，领域类型（exactOptionalPropertyTypes）不接受显式 undefined。
 *  这里把 undefined 的键去掉。 */
export function toPersonalization(dto: PersonalizationDto): Personalization {
  const p: Personalization = { toName: dto.toName };
  if (dto.fromName !== undefined) p.fromName = dto.fromName;
  if (dto.fromCity !== undefined) p.fromCity = dto.fromCity;
  return p;
}
