// 预期内的失败用 Result 返回，调用方必须处理；意外错误才 throw。
// 见 docs/engineering/coding-standards.md §5。

import type { AppError } from './errors';

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
