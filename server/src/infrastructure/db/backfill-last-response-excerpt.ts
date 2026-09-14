// 一次性回填：为 response_count > 0 但 last_response_excerpt IS NULL 的存量祈福补摘录。
// 上线前跑一次，否则广场首屏在上线当天全是空摘录（见 redesign-kindness-entry design 迁移计划第 2 条）。
// 用法：`BW_PGDATA=<路径> pnpm --filter @bestwishes/server backfill:last-response-excerpt`

import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { truncateResponseExcerpt } from '@bestwishes/domain';
import { createDb, migrateToLatest } from './client';
import { wishRequests, blessings } from './schema';

async function main(): Promise<void> {
  const dataDir = process.env['BW_PGDATA'];
  const handle = createDb(dataDir);
  const { db } = handle;
  try {
    await migrateToLatest(db);

    const stale = await db
      .select({ id: wishRequests.id })
      .from(wishRequests)
      .where(and(gt(wishRequests.responseCount, 0), isNull(wishRequests.lastResponseExcerpt)));

    let updated = 0;
    for (const { id } of stale) {
      const [latest] = await db
        .select({ body: blessings.body, media: blessings.media })
        .from(blessings)
        .where(and(eq(blessings.requestId, id), eq(blessings.state, 'published')))
        .orderBy(desc(blessings.createdAt))
        .limit(1);
      if (!latest) continue;

      const excerpt = truncateResponseExcerpt(latest.media?.transcript ?? latest.body);
      await db
        .update(wishRequests)
        .set({ lastResponseExcerpt: excerpt })
        .where(eq(wishRequests.id, id));
      updated++;
    }

    console.log(`回填完成：检查 ${String(stale.length)} 条，更新 ${String(updated)} 条`);
  } finally {
    await handle.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
