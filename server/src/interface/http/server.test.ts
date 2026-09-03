import { describe, it, expect } from 'vitest';
import { makeServer } from './test-server';

describe('server 骨架', () => {
  it('健康检查返回 ok + 注入的时间', async () => {
    const { server } = await makeServer();
    const res = await server.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, at: '2026-09-04T00:00:00.000Z' });
    await server.close();
  });

  it('未知路由 404', async () => {
    const { server } = await makeServer();
    const res = await server.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    await server.close();
  });

  it('未登录访问需要会话的接口 → 401', async () => {
    const { server } = await makeServer();
    const res = await server.inject({ method: 'GET', url: '/api/streak/me' });
    expect(res.statusCode).toBe(401);
    await server.close();
  });
});
