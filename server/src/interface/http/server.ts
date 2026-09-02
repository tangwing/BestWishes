// Fastify 实例的组装。路由 handler 保持薄：解析请求 → 调 application → 映射结果。
// 迭代 1 只有健康检查；P1 的业务路由在后续迭代加进来。

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ErrorCode } from '@bestwishes/shared';
import { httpStatusFor } from './errors';
import type { Clock } from '../../ports/clock';
import type { Env } from '../../config/env';

export interface ServerDeps {
  clock: Clock;
  env: Env;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: deps.env.NODE_ENV === 'test' ? 'silent' : 'info' },
    genReqId: () => randomUUID(),
  });

  // 统一错误处理：领域错误按错误码映射 status，其余按 500。
  app.setErrorHandler((error, request, reply) => {
    const appErr = extractAppError(error);
    if (appErr) {
      request.log.info({ code: appErr.code, msg: appErr.message }, 'app error');
      void reply.status(httpStatusFor(appErr.code)).send({
        error: appErr.code,
        message: appErr.userHint ?? appErr.message,
      });
      return;
    }
    request.log.error({ err: error }, 'unhandled error');
    void reply.status(500).send({ error: 'internal', message: '服务出了点问题，稍后再试' });
  });

  app.get('/healthz', () => ({ ok: true, at: deps.clock.now().toISOString() }));

  return app;
}

interface AppErrorShape {
  code: ErrorCode;
  message: string;
  userHint?: string;
}

function extractAppError(error: unknown): AppErrorShape | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error
  ) {
    return error as AppErrorShape;
  }
  return null;
}
