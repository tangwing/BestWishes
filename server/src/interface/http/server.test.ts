import { describe, it, expect } from 'vitest';
import { buildServer } from './server';

const fixedClock = { now: () => new Date('2026-09-02T00:00:00Z') };

describe('server 骨架', () => {
  it('健康检查返回 ok + 注入的时间', async () => {
    const app = buildServer({ clock: fixedClock });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, at: '2026-09-02T00:00:00.000Z' });
    await app.close();
  });

  it('未知路由 404', async () => {
    const app = buildServer({ clock: fixedClock });
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
