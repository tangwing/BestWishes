import type { ModerationProvider, P1Config } from '@bestwishes/domain';
import type { Clock } from '../ports/clock';
import type { IdGenerator, SlugGenerator } from '../ports/ids';
import type { Repositories } from '../ports/repositories';

export interface AppDeps {
  repos: Repositories;
  clock: Clock;
  ids: IdGenerator;
  slugs: SlugGenerator;
  moderation: ModerationProvider;
  config: P1Config;
}

/** 现行协议版本。改条款时递增，用户下次创作要重新确认。 */
export const AGREEMENT_VERSION = '2026-09-02';
