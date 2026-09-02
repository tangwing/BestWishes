// ESLint flat config。规范见 docs/engineering/coding-standards.md。
// 架构分层的机制化强制主要靠 dependency-cruiser（.dependency-cruiser.cjs）；
// 这里加一条 no-restricted-imports 兜底领域层纯净。

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      'prototype/**',
      'docs/**',
      '**/*.dc.html',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // 允许对字符串用 || 兜底（"空字符串也算没填，往下取默认值" 是常见且正确的写法）
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // 前端是 UI 胶水层：返回类型显然、事件回调常用箭头简写、模板里常插数字。
    // 更严的类型保证放在 domain / application / infrastructure。
    files: ['client/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // application 服务用工厂模式，导出类型 = ReturnType<typeof 工厂>，不会和实现脱节；
    // 测试脚手架同理
    files: ['server/src/application/**/*.ts', '**/test-{server,harness}.ts'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'fastify',
                'zod',
                '@bestwishes/*',
                'node:*',
                '**/infrastructure/**',
                '**/interface/**',
              ],
              message: '领域层必须保持纯净：不依赖框架、IO、其它层。见 coding-standards §3。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'arch/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
    },
  },
  {
    // 配置文件不在任何 tsconfig 里，关掉需要类型信息的规则
    files: ['**/*.config.{js,ts,cjs,mjs}', '**/.*.cjs', 'vitest.workspace.ts', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false } },
  },
);
