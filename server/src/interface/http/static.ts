// 演示 / 生产：如果 client 已 build，服务端直接托管 client/dist，
// 未匹配的非 /api 请求回退到 index.html（SPA fallback）。
// 真实部署更可能是 client / server 分开托管（见 ADR 0003 D12）。

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const here = dirname(fileURLToPath(import.meta.url));
const clientDist = join(here, '../../../../client/dist');

export async function registerStatic(app: FastifyInstance, enabled: boolean): Promise<boolean> {
  if (!enabled) return false;
  if (!existsSync(join(clientDist, 'index.html'))) return false;

  await app.register(fastifyStatic, { root: clientDist, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api') || request.method !== 'GET') {
      void reply.status(404).send({ error: 'not_found', message: 'not found' });
      return;
    }
    void reply.sendFile('index.html');
  });

  return true;
}
