import { defineWorkspace } from 'vitest/config';

// 分层测试：每套一个 project，可 `vitest run --project <name>` 单跑。
export default defineWorkspace([
  {
    test: {
      name: 'domain',
      root: './packages/domain',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'shared',
      root: './packages/shared',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: { name: 'server', root: './server', environment: 'node', include: ['src/**/*.test.ts'] },
  },
  { test: { name: 'arch', root: './arch', environment: 'node', include: ['*.test.ts'] } },
]);
