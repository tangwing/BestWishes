// 定时扫描：延迟送达到点发布、链接到期、hold 超时升级。
// main.ts 里用 setInterval 定期调；测试里手动调 + 可注入时钟。

import type { AppDeps } from './deps';
import { transitionAndPersist } from './blessing-write';

export function createScans(deps: AppDeps) {
  return {
    /** hold 到点、且没有待复核工单的 verifying 祝福 → 发布。 */
    async publishReady(): Promise<number> {
      const now = deps.clock.now();
      const verifying = await deps.repos.blessings.listByState('verifying');
      let published = 0;
      for (const b of verifying) {
        if (!b.holdUntil || new Date(b.holdUntil) > now) continue;
        const ticket = await deps.repos.reports.findOpenAutoSuspect(b.id);
        if (ticket) continue;
        const r = await transitionAndPersist(
          deps,
          b,
          'auto_pass',
          { kind: 'system' },
          '延迟送达 hold 结束',
          null,
        );
        if (r.ok) published += 1;
      }
      return published;
    },

    /** 到期的 published 祝福 → expired。 */
    async expire(): Promise<number> {
      const now = deps.clock.now();
      const published = await deps.repos.blessings.listByState('published');
      let expired = 0;
      for (const b of published) {
        if (!b.expiresAt || new Date(b.expiresAt) > now) continue;
        const r = await transitionAndPersist(deps, b, 'expire', { kind: 'system' }, '链接到期');
        if (r.ok) expired += 1;
      }
      return expired;
    },

    /** hold 超过上限仍卡在 verifying → 记一条升级事件（不改状态）。 */
    async escalateStuck(): Promise<number> {
      const now = deps.clock.now();
      const verifying = await deps.repos.blessings.listByState('verifying');
      let escalated = 0;
      for (const b of verifying) {
        const ageMs = now.getTime() - new Date(b.createdAt).getTime();
        if (ageMs <= deps.config.holdTimeoutHours * 3_600_000) continue;
        const already = await deps.repos.blessingEvents.listForBlessing(b.id);
        if (already.some((e) => e.reason === 'hold 超时已升级')) continue;
        await deps.repos.blessingEvents.append({
          id: deps.ids.next('bev'),
          blessingId: b.id,
          from: 'verifying',
          to: 'verifying',
          trigger: 'submit',
          actor: { kind: 'system' },
          reason: 'hold 超时已升级',
          at: now.toISOString(),
        });
        escalated += 1;
      }
      return escalated;
    },
  };
}

export type Scans = ReturnType<typeof createScans>;
