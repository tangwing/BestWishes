// Fastify 实例的组装。路由 handler 保持薄：解析请求 → 调 application → 映射结果。
// 迭代 1 只有健康检查；P1 的业务路由在后续迭代加进来。

import Fastify, { type FastifyInstance } from 'fastify';
import { httpStatusFor } from './errors';
import type { Clock } from '../../ports/clock';

export interface ServerDeps {
  clock: Clock;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
    genReqId: () => crypto.randomUUID(),
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

function extractAppError(
  error: unknown,
): { code: import('@bestwishes/shared').ErrorCode; message: string; userHint?: string } | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    'message' in error
  ) {
    return error as { code: import('@bestwishes/shared').ErrorCode; message: string; userHint?: string };
  }
  return null;
}
