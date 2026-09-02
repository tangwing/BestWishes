// 运营可调配置。默认值在 @bestwishes/domain 的 DEFAULT_CONFIG；
// 这里允许用环境变量覆盖（部署时不改代码）。

import { z } from 'zod';
import { DEFAULT_CONFIG, type P1Config } from '@bestwishes/domain';

const overridesSchema = z.object({
  BW_FEATURED_DEFAULT_ON: z.enum(['true', 'false']).optional(),
  BW_BODY_MIN_LEN: z.coerce.number().int().positive().optional(),
  BW_BODY_MAX_LEN: z.coerce.number().int().positive().optional(),
  BW_LINK_TTL_DAYS: z.coerce.number().int().positive().optional(),
  BW_HOLD_SECONDS: z.coerce.number().min(0).optional(),
  BW_HOLD_TIMEOUT_HOURS: z.coerce.number().positive().optional(),
  BW_SPOT_CHECK_RATIO: z.coerce.number().min(0).max(1).optional(),
});

export function loadP1Config(source: NodeJS.ProcessEnv = process.env): P1Config {
  const o = overridesSchema.parse(source);
  return {
    featuredDefaultOn:
      o.BW_FEATURED_DEFAULT_ON === undefined
        ? DEFAULT_CONFIG.featuredDefaultOn
        : o.BW_FEATURED_DEFAULT_ON === 'true',
    bodyMinLen: o.BW_BODY_MIN_LEN ?? DEFAULT_CONFIG.bodyMinLen,
    bodyMaxLen: o.BW_BODY_MAX_LEN ?? DEFAULT_CONFIG.bodyMaxLen,
    linkTtlDays: o.BW_LINK_TTL_DAYS ?? DEFAULT_CONFIG.linkTtlDays,
    holdSeconds: o.BW_HOLD_SECONDS ?? DEFAULT_CONFIG.holdSeconds,
    holdTimeoutHours: o.BW_HOLD_TIMEOUT_HOURS ?? DEFAULT_CONFIG.holdTimeoutHours,
    spotCheckRatio: o.BW_SPOT_CHECK_RATIO ?? DEFAULT_CONFIG.spotCheckRatio,
    publicInvalidationSeconds: DEFAULT_CONFIG.publicInvalidationSeconds,
  };
}
