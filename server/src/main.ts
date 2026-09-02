// 组合根：装配依赖、启动。这是唯一 new 具体实现的地方。

import { loadEnv } from './config/env';
import { SystemClock } from './infrastructure/system-clock';
import { buildServer } from './interface/http/server';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = buildServer({ clock: new SystemClock() });

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
