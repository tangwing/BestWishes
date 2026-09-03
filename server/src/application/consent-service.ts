import { appError, type Result, ok, err } from '@bestwishes/shared';
import { AGREEMENT_VERSION, type AppDeps } from './deps';

export interface AgreementView {
  version: string;
  /** 「精选展示」这一项的默认勾选状态：用户个人偏好优先，否则系统默认 */
  featuredDefaultChecked: boolean;
  /** 用户是否已经对当前版本协议留过同意记录（前端据此决定要不要先走协议页） */
  alreadyConsented: boolean;
}

export interface RecordConsentInput {
  scopeDeliver: boolean;
  scopeFeatured: boolean;
  scopeSynthesis: boolean;
}

export function createConsentService(deps: AppDeps) {
  return {
    async agreement(userId: string): Promise<AgreementView> {
      const [profile, consent] = await Promise.all([
        deps.repos.profiles.get(userId),
        deps.repos.consents.latestForVersion(userId, AGREEMENT_VERSION),
      ]);
      return {
        version: AGREEMENT_VERSION,
        featuredDefaultChecked: profile?.featuredByDefault ?? deps.config.featuredDefaultOn,
        alreadyConsented: consent !== null,
      };
    },

    async hasValidConsent(userId: string): Promise<boolean> {
      const c = await deps.repos.consents.latestForVersion(userId, AGREEMENT_VERSION);
      return c !== null;
    },

    async record(userId: string, input: RecordConsentInput): Promise<Result<null>> {
      if (!input.scopeDeliver) {
        return err(
          appError(
            'consent_required',
            'must agree to delivery scope',
            '不同意「送达」授权，就没法生成可分享的祝福。',
          ),
        );
      }
      await deps.repos.consents.add({
        id: deps.ids.next('cns'),
        userId,
        agreementVersion: AGREEMENT_VERSION,
        scopeDeliver: true,
        scopeFeatured: input.scopeFeatured,
        scopeSynthesis: input.scopeSynthesis,
        agreedAt: deps.clock.now().toISOString(),
      });
      return ok(null);
    },
  };
}

export type ConsentService = ReturnType<typeof createConsentService>;
