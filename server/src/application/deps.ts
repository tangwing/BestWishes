import type { ModerationProvider, P1Config } from '@bestwishes/domain';
import type { AsrProvider } from '../ports/asr';
import type { AudioStoragePort } from '../ports/audio-storage';
import type { Clock } from '../ports/clock';
import type { IdGenerator, SlugGenerator } from '../ports/ids';
import type { LivenessChallengePort } from '../ports/liveness';
import type { Repositories } from '../ports/repositories';
import type { SincerityEvaluator } from '../ports/sincerity-evaluator';

export interface AppDeps {
  repos: Repositories;
  clock: Clock;
  ids: IdGenerator;
  slugs: SlugGenerator;
  moderation: ModerationProvider;
  config: P1Config;
  audioStorage: AudioStoragePort;
  asr: AsrProvider;
  sincerity: SincerityEvaluator;
  liveness: LivenessChallengePort;
}

/** 现行协议版本。改条款时递增，用户下次创作要重新确认。
 *  2026-09-04：协议范围从「送达给你分享的人」改为「群发给符合条件的陌生人」。 */
export const AGREEMENT_VERSION = '2026-09-04';
