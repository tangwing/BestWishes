// 本机落盘的音频存储。开发 / 测试 / 演示用；生产换对象存储时只换这个文件，
// AudioStoragePort 接口不变——同 PGlite -> drizzle-orm/postgres-js 的既有模式。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AudioStoragePort } from '../../ports/audio-storage';

export class LocalAudioStorage implements AudioStoragePort {
  constructor(private readonly dir: string) {}

  private pathFor(id: string): string {
    return join(this.dir, `${id}.webm`);
  }

  async save(id: string, data: Buffer): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const path = this.pathFor(id);
    await writeFile(path, data);
    return `/api/audio/${id}`;
  }

  async read(id: string): Promise<Buffer> {
    return readFile(this.pathFor(id));
  }
}
