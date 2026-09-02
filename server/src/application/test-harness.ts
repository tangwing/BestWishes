// 测试用：一套内存依赖 + 可拨动的时钟，装出一个 application。

import { DEFAULT_CONFIG, RuleBasedProvider, UnavailableProvider } from '@bestwishes/domain';
import type { Clock } from '../ports/clock';
import { SequentialIdGenerator, SequentialSlugGenerator } from '../infrastructure/ids';
import { createInMemoryRepositories } from '../infrastructure/memory/in-memory-repositories';
import type { TemplateRecord } from '../ports/records';
import { createApplication } from './index';

export class FakeClock implements Clock {
  private current: number;
  constructor(iso = '2026-09-02T00:00:00.000Z') {
    this.current = new Date(iso).getTime();
  }
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

export function makeApp(
  opts: {
    moderation?: 'rules' | 'unavailable';
    templates?: TemplateRecord[];
    holdSeconds?: number;
  } = {},
) {
  const clock = new FakeClock();
  const repos = createInMemoryRepositories({
    ids: new SequentialIdGenerator(),
    templates: opts.templates ?? [],
  });
  const config = { ...DEFAULT_CONFIG, holdSeconds: opts.holdSeconds ?? 5 };
  const app = createApplication({
    repos,
    clock,
    ids: new SequentialIdGenerator(),
    slugs: new SequentialSlugGenerator(),
    moderation:
      opts.moderation === 'unavailable'
        ? new UnavailableProvider()
        : new RuleBasedProvider({ config }),
    config,
  });
  return { app, clock, repos, config };
}
