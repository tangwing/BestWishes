// AppError 的错误码 → HTTP status，集中一处。handler 里不写 try/catch 拼 status。

import type { ErrorCode } from '@bestwishes/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  consent_required: 403,
  blessing_state_conflict: 409,
  paste_not_allowed: 422,
  rate_limited: 429,
  moderation_unavailable: 503,
  internal: 500,
};

export function httpStatusFor(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
