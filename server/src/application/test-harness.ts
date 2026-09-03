// 测试用：一套内存依赖 + 可拨动的时钟，装出一个 application。

import {
  DEFAULT_CONFIG,
  RuleBasedProvider,
  UnavailableProvider,
  type Gender,
} from '@bestwishes/domain';
import type { Clock } from '../ports/clock';
import { SequentialIdGenerator, SequentialSlugGenerator } from '../infrastructure/ids';
import { createInMemoryRepositories } from '../infrastructure/memory/in-memory-repositories';
import type { TemplateRecord } from '../ports/records';
import { createApplication } from './index';

export class FakeClock implements Clock {
  private current: number;
  constructor(iso = '2026-09-04T00:00:00.000Z') {
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
    maxAudienceSize?: number;
  } = {},
) {
  const clock = new FakeClock();
  const repos = createInMemoryRepositories({
    ids: new SequentialIdGenerator(),
    templates: opts.templates ?? [],
  });
  const config = {
    ...DEFAULT_CONFIG,
    holdSeconds: opts.holdSeconds ?? 5,
    maxAudienceSize: opts.maxAudienceSize ?? DEFAULT_CONFIG.maxAudienceSize,
  };
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

export interface SeedUserOpts {
  nickname: string;
  consent?: boolean;
  lat?: number;
  lng?: number;
  gender?: Gender;
  birthYear?: number;
  tags?: string[];
}

/** 建一个用户 + 设好画像（位置 / 性别 / 年龄 / 标签）+ 可选同意协议。返回 userId。 */
export async function seedUser(
  ctx: ReturnType<typeof makeApp>,
  opts: SeedUserOpts,
): Promise<string> {
  const user = await ctx.app.auth.loginWithStub(opts.nickname);
  const patch: Parameters<typeof ctx.app.profile.update>[1] = {};
  if (opts.lat !== undefined) patch.lat = opts.lat;
  if (opts.lng !== undefined) patch.lng = opts.lng;
  if (opts.gender !== undefined) patch.gender = opts.gender;
  if (opts.birthYear !== undefined) patch.birthYear = opts.birthYear;
  if (opts.tags !== undefined) patch.tags = opts.tags;
  if (Object.keys(patch).length > 0) await ctx.app.profile.update(user.id, patch);
  if (opts.consent ?? false) {
    await ctx.app.consent.record(user.id, {
      scopeDeliver: true,
      scopeFeatured: true,
      scopeSynthesis: false,
    });
  }
  return user.id;
}
