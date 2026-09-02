// 架构规则。每条规则挡住一类会让代码变乱的依赖。
// 跑：npm run test:arch  （CI 里单独一步，最先跑）
// 真实项目的完整版见 docs/engineering/coding-standards.md §3.1。

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment:
        '领域逻辑（src/domain）必须能脱离框架单独测试。不许 import React、路由、或存储层。',
      severity: 'error',
      from: { path: '^src/domain' },
      to: {
        path: '^(src/app|src/store)|node_modules/(react|react-dom|react-router-dom)',
      },
    },
    {
      name: 'domain-no-node-builtins',
      comment: '领域逻辑不碰文件系统 / 网络等 Node 内建（时间和随机数靠参数注入）。',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'store-not-imported-by-domain',
      comment: '存储层是外圈，领域是内圈，依赖只能从外指向内。',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/store' },
    },
    {
      name: 'no-circular',
      comment: '循环依赖 = 说不清谁依赖谁，后面很难拆。',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: '没人 import 的文件（除配置和入口）通常是忘了删的死代码。',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.(json|d\\.ts)$',
          '(^|/)(vite\\.config|\\.dependency-cruiser)\\.',
          '(^|/)src/app/main\\.tsx$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.test\\.(ts|tsx)$' },
  },
};
