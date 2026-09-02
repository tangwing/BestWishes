import { randomUUID } from 'node:crypto';
import type { IdGenerator, SlugGenerator } from '../ports/ids';

export class RandomIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }
}

export class RandomSlugGenerator implements SlugGenerator {
  next(): string {
    // 22 个 base64url 字符 ≈ 128 bit，不可枚举
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 6);
  }
}

/** 测试用：确定性、可读。 */
export class SequentialIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>();
  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${String(n)}`;
  }
}

export class SequentialSlugGenerator implements SlugGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `slug${String(this.n)}`;
  }
}
