// 数据库连接。P1 用 PGlite（Postgres 编译成 WASM，进程内跑，无需本机装 Postgres）。
// 生产换成独立 Postgres 时，把 drizzle 驱动换成 `drizzle-orm/postgres-js`，schema 和仓储不动。

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

export type Db = PgliteDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../../drizzle');

/**
 * 建一个连接。
 * `dataDir` 不传 = 纯内存（进程退出即清空，测试 / 演示用）；传路径 = 落盘持久化。
 */
export function createDb(dataDir?: string): DbHandle {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return { db, close: () => client.close() };
}

/** 把 server/drizzle/ 下的迁移跑到最新。 */
export async function migrateToLatest(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
