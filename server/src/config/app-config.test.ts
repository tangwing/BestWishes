import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '@bestwishes/domain';
import { loadP1Config } from './app-config';

describe('loadP1Config', () => {
  it('没有环境变量时用默认值', () => {
    expect(loadP1Config({})).toEqual(DEFAULT_CONFIG);
  });

  it('环境变量覆盖对应项', () => {
    const cfg = loadP1Config({
      BW_BODY_MIN_LEN: '20',
      BW_LINK_TTL_DAYS: '180',
      BW_FEATURED_DEFAULT_ON: 'false',
    });
    expect(cfg.bodyMinLen).toBe(20);
    expect(cfg.linkTtlDays).toBe(180);
    expect(cfg.featuredDefaultOn).toBe(false);
    expect(cfg.bodyMaxLen).toBe(DEFAULT_CONFIG.bodyMaxLen);
  });

  it('非法比例被拒绝', () => {
    expect(() => loadP1Config({ BW_SPOT_CHECK_RATIO: '2' })).toThrow();
  });
});
