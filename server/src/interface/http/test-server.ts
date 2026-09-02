// 测试用：一个跑在内存依赖 + FakeClock 上的完整 server。
// 返回 { server: Fastify, app: Application, clock, repos, config }。

import type { Env } from '../../config/env';
import { makeApp } from '../../application/test-harness';
import { buildServer } from './server';

const testEnv: Env = { NODE_ENV: 'test', PORT: 0, HOST: '127.0.0.1' };

export async function makeServer(opts?: Parameters<typeof makeApp>[0]) {
  const ctx = makeApp(opts);
  const server = await buildServer({ clock: ctx.clock, env: testEnv, application: ctx.app });
  return { server, app: ctx.app, clock: ctx.clock, repos: ctx.repos, config: ctx.config };
}
