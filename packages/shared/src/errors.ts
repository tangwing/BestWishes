// 全平台的错误码。日志和 metric 按这些码聚合；HTTP 层统一把它们映射到 status。

export const ERROR_CODES = [
  'unauthorized', // 没登录 / 会话失效
  'forbidden', // 登录了但没权限做这个操作
  'not_found', // 资源不存在
  'validation_failed', // 输入不合法
  'consent_required', // 还没同意《授权协议》
  'blessing_state_conflict', // 对祝福做了它当前状态不允许的操作
  'paste_not_allowed', // 正文是粘贴进来的
  'rate_limited', // 触发限流
  'moderation_unavailable', // 内容审核服务不可用
  'internal', // 兜底：意外错误
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  code: ErrorCode;
  message: string;
  /** 面向用户的提示（可选，没有就用 message） */
  userHint?: string;
}

export function appError(code: ErrorCode, message: string, userHint?: string): AppError {
  return userHint === undefined ? { code, message } : { code, message, userHint };
}
