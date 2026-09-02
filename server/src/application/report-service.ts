import type { ReportCategory } from '@bestwishes/domain';
import { appError, err, ok, type Result } from '@bestwishes/shared';
import type { AppDeps } from './deps';
import { transitionAndPersist } from './blessing-write';

/** 高危大类：触发即时临时下架，等人工复核。 */
function isHighRisk(category: ReportCategory): boolean {
  return category === 'illegal' || category === 'offensive';
}

export function createReportService(deps: AppDeps) {
  return {
    async report(
      slug: string,
      category: ReportCategory,
      note: string,
      fingerprint: string,
    ): Promise<Result<null>> {
      const b = await deps.repos.blessings.findBySlug(slug);
      if (!b) return err(appError('not_found', 'blessing not found', '找不到这份祝福'));

      const now = deps.clock.now().toISOString();
      const existing = await deps.repos.reports.findOpenReportByFingerprint(b.id, fingerprint);
      if (existing) {
        await deps.repos.reports.save({
          ...existing,
          count: existing.count + 1,
          timeline: [...existing.timeline, { at: now, text: '同一来源重复举报，合并计数' }],
        });
        return ok(null);
      }

      const highRisk = isHighRisk(category);
      await deps.repos.reports.add({
        id: deps.ids.next('rpt'),
        blessingId: b.id,
        origin: 'report',
        category,
        state: 'open',
        priority: highRisk ? 90 : 60,
        note: note || null,
        assignee: null,
        resolutionReason: null,
        reporterFingerprint: fingerprint,
        count: 1,
        createdAt: now,
        resolvedAt: null,
        timeline: [{ at: now, text: '工单创建（report）' }],
      });

      if (highRisk && b.state === 'published') {
        await transitionAndPersist(
          deps,
          b,
          'report_takedown',
          { kind: 'system' },
          '高危举报即时临时下架',
        );
      }
      return ok(null);
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
