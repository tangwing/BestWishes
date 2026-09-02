// Fastify 实例的组装。路由 handler 保持薄：解析请求 → 调 application → 映射结果。
// 迭代 1 只有健康检查；P1 的业务路由在后续迭代加进来。

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { isAppException } from '@bestwishes/shared';
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

  // 统一错误处理：application 层抛的 AppException 按错误码映射 status，其余按 500。
  app.setErrorHandler((error, request, reply) => {
    if (isAppException(error)) {
      request.log.info({ code: error.code, msg: error.message }, 'app error');
      void reply.status(httpStatusFor(error.code)).send({
        error: error.code,
        message: error.userHint ?? error.message,
      });
      return;
    }
    request.log.error({ err: error }, 'unhandled error');
    void reply.status(500).send({ error: 'internal', message: '服务出了点问题，稍后再试' });
  });

  app.get('/healthz', () => ({ ok: true, at: deps.clock.now().toISOString() }));

  return app;
}
