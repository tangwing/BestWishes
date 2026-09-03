import type { AppDeps } from './deps';
import { createAuthService } from './auth-service';
import { createProfileService } from './profile-service';
import { createConsentService } from './consent-service';
import { createDraftService } from './draft-service';
import { createBlessingService } from './blessing-service';
import { createAudienceService } from './audience-service';
import { createInboxService } from './inbox-service';
import { createNotificationService } from './notification-service';
import { createStreakService } from './streak-service';
import { createScans } from './scans';
import { createReportService } from './report-service';
import { createModerationQueueService } from './moderation-queue-service';

export function createApplication(deps: AppDeps) {
  return {
    auth: createAuthService(deps),
    profile: createProfileService(deps),
    consent: createConsentService(deps),
    drafts: createDraftService(deps),
    blessings: createBlessingService(deps),
    audience: createAudienceService(deps),
    inbox: createInboxService(deps),
    notifications: createNotificationService(deps),
    streak: createStreakService(deps),
    reports: createReportService(deps),
    moderationQueue: createModerationQueueService(deps),
    scans: createScans(deps),
    templates: {
      list: (): ReturnType<typeof deps.repos.templates.listActive> =>
        deps.repos.templates.listActive(),
    },
  };
}

export type Application = ReturnType<typeof createApplication>;
export type { AppDeps } from './deps';
export { AGREEMENT_VERSION } from './deps';
