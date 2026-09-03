// 手动跑迁移：`pnpm --filter @bestwishes/server db:migrate`。
// 传 BW_PGDATA 指定落盘目录，否则跑在内存里（内存迁移只用来验证 SQL 能过）。

import { createDb, migrateToLatest } from './client';

async function main(): Promise<void> {
  const dataDir = process.env['BW_PGDATA'];
  const handle = createDb(dataDir);
  try {
    await migrateToLatest(handle.db);
    console.log(dataDir ? `迁移完成: ${dataDir}` : '迁移完成（内存，未落盘）');
  } finally {
    await handle.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
