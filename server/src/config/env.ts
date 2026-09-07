// 环境变量集中在这里解析一次。别处 import 解析后的对象，不散落 process.env。

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  // 数据层：memory = 进程内存（默认，重启即清空）；pglite = WASM Postgres，跑真实 SQL。
  BW_DB: z.enum(['memory', 'pglite']).default('memory'),
  // pglite 落盘目录。不设则纯内存。
  BW_PGDATA: z.string().optional(),
  // 音频文件落盘目录。
  BW_AUDIO_DIR: z.string().default('./.audio-data'),
  // 挑战式真人校验的 HMAC 签名密钥。生产环境务必用真正的随机密钥覆盖。
  BW_LIVENESS_SECRET: z.string().default('dev-only-liveness-secret-change-in-prod'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`环境变量不合法:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
