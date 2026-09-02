// 架构规则。每条挡住一类会让代码变乱的依赖。跑：pnpm test:arch
// 说明见 docs/engineering/coding-standards.md §3.1。

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment:
        '领域逻辑（packages/domain）必须能脱离框架单独测试：不依赖框架、ORM、其它层、Node 内建。',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: {
        pathNot: '^packages/domain/src',
        path: '.',
      },
    },
    {
      name: 'domain-no-node-core',
      comment: '领域逻辑不碰 fs / net / crypto 等（时间和随机数靠参数注入）。',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'shared-no-app-code',
      comment: 'shared 是跨端共享的类型 / schema，不依赖 server / client / domain 实现。',
      severity: 'error',
      from: { path: '^packages/shared/src' },
      to: { path: '^(server|client|packages/domain)/' },
    },
    {
      name: 'application-not-import-infra-or-interface',
      comment: 'application 只依赖 domain 和 ports（接口），不碰 infrastructure / interface。',
      severity: 'error',
      from: { path: '^server/src/application' },
      to: { path: '^server/src/(infrastructure|interface)/' },
    },
    {
      name: 'domain-and-application-not-import-interface',
      comment: '入口适配器（interface）在最外圈，不能被里面的层依赖。',
      severity: 'error',
      from: { path: '^server/src/(application|ports)/' },
      to: { path: '^server/src/interface/' },
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
          '(^|/)(vite\\.config|\\.dependency-cruiser|eslint\\.config)\\.',
          '(^|/)src/(main|index)\\.(ts|tsx)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.test\\.(ts|tsx)$|test-harness\\.ts$|^arch/|/prototype/|/(dist|build)/)' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
