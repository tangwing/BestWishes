import { defineConfig } from 'drizzle-kit';

// 迁移生成配置。`pnpm --filter @bestwishes/server db:generate` 读 schema.ts，
// 把 DDL 落到 server/drizzle/。运行迁移见 src/infrastructure/db/migrate.ts。
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
});
