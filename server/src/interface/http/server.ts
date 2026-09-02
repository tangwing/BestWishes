// Fastify 实例的组装。路由 handler 保持薄：解析请求 → 调 application → 映射结果。

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { isAppException } from '@bestwishes/shared';
import { httpStatusFor } from './errors';
import { registerRoutes } from './routes';
import { registerStatic } from './static';
import type { Application } from '../../application';
import type { Clock } from '../../ports/clock';
import type { Env } from '../../config/env';

export interface ServerDeps {
  clock: Clock;
  env: Env;
  application: Application;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: deps.env.NODE_ENV === 'test' ? 'silent' : 'info' },
    genReqId: () => randomUUID(),
  });

  await app.register(cookie);

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

  registerRoutes(app, deps.application);
  const servingClient = await registerStatic(app, deps.env.NODE_ENV !== 'test');
  if (deps.env.NODE_ENV !== 'test') {
    app.log.info(
      { servingClient },
      servingClient ? '托管 client/dist' : 'client 未 build，只提供 API',
    );
  }

  return app;
}
