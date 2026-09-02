import type { AppDeps } from './deps';
import { createAuthService } from './auth-service';
import { createProfileService } from './profile-service';
import { createConsentService } from './consent-service';
import { createDraftService } from './draft-service';
import { createBlessingService } from './blessing-service';
import { createStreakService } from './streak-service';
import { createScans } from './scans';

export function createApplication(deps: AppDeps) {
  return {
    auth: createAuthService(deps),
    profile: createProfileService(deps),
    consent: createConsentService(deps),
    drafts: createDraftService(deps),
    blessings: createBlessingService(deps),
    streak: createStreakService(deps),
    scans: createScans(deps),
    templates: {
      list: () => deps.repos.templates.listActive(),
    },
  };
}

export type Application = ReturnType<typeof createApplication>;
export type { AppDeps } from './deps';
export { AGREEMENT_VERSION } from './deps';
