// 组合根：装配依赖、启动、跑扫描任务。这是唯一 new 具体实现的地方。

import { RuleBasedProvider } from '@bestwishes/domain';
import { loadEnv, type Env } from './config/env';
import { loadP1Config } from './config/app-config';
import { createApplication } from './application';
import { SystemClock } from './infrastructure/system-clock';
import { RandomIdGenerator, RandomSlugGenerator } from './infrastructure/ids';
import { createInMemoryRepositories } from './infrastructure/memory/in-memory-repositories';
import { createDb, migrateToLatest } from './infrastructure/db/client';
import { createPgRepositories, seedPgTemplates } from './infrastructure/pg/pg-repositories';
import { seedTemplates } from './infrastructure/templates-seed';
import type { Repositories } from './ports/repositories';
import { buildServer } from './interface/http/server';

async function buildRepos(env: Env): Promise<{ repos: Repositories; close: () => Promise<void> }> {
  const templates = seedTemplates();
  const ids = new RandomIdGenerator();

  if (env.BW_DB === 'pglite') {
    const handle = createDb(env.BW_PGDATA);
    await migrateToLatest(handle.db);
    await seedPgTemplates(handle.db, templates);
    return { repos: createPgRepositories(handle.db, ids), close: handle.close };
  }

  return {
    repos: createInMemoryRepositories({ ids, templates }),
    close: () => Promise.resolve(),
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const config = loadP1Config();
  const clock = new SystemClock();

  const { repos, close } = await buildRepos(env);

  const application = createApplication({
    repos,
    clock,
    ids: new RandomIdGenerator(),
    slugs: new RandomSlugGenerator(),
    moderation: new RuleBasedProvider({ config }),
    config,
  });

  // 扫描任务：延迟送达到点发布、链接到期、hold 超时升级
  const scanTimer = setInterval(() => {
    void application.scans.publishReady();
    void application.scans.expire();
    void application.scans.escalateStuck();
  }, 3000);
  scanTimer.unref();

  const app = await buildServer({ clock, env, application });
  app.addHook('onClose', () => close());
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
