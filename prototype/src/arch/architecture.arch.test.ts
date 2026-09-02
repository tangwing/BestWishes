// 架构测试 —— 守住分层，别让依赖方向乱掉。
// 这是独立的一套：文件名 *.arch.test.ts，也可以单独 `npm run test:arch` 跑。
// dependency-cruiser 是主的检查（见 .dependency-cruiser.cjs）；这里再加几条它不好表达的断言。

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) specs.push(m[1] ?? m[2]);
  return specs;
}

const domainFiles = walk(join(ROOT, 'domain'));

describe('领域层保持纯净', () => {
  it('有领域文件可检查', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  it('不 import 前端 / 路由 / 存储层', () => {
    const bad: string[] = [];
    for (const file of domainFiles) {
      for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
        const isFrontend = /^(react|react-dom|react-router-dom)/.test(spec);
        const isStoreOrApp = /(^|\/)(store|app)(\/|$)/.test(spec) || spec.includes('../store') || spec.includes('../app');
        if (isFrontend || isStoreOrApp) {
          bad.push(`${relative(ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(bad, `领域层出现了不该有的依赖:\n${bad.join('\n')}`).toEqual([]);
  });

  it('不 import Node 内建模块（fs / path / net 等）', () => {
    const bad: string[] = [];
    for (const file of domainFiles) {
      for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (/^node:/.test(spec) || ['fs', 'path', 'net', 'http', 'https', 'crypto', 'os'].includes(spec)) {
          bad.push(`${relative(ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('不用 Date.now() / Math.random()（时间和随机数靠参数传进来）', () => {
    const bad: string[] = [];
    for (const file of domainFiles) {
      const src = readFileSync(file, 'utf8');
      if (/\bDate\.now\s*\(/.test(src)) bad.push(`${relative(ROOT, file)}: Date.now()`);
      if (/\bMath\.random\s*\(/.test(src)) bad.push(`${relative(ROOT, file)}: Math.random()`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

describe('存储层依赖领域层，不反过来', () => {
  it('domain 目录里没有任何文件 import ../store', () => {
    const offenders = domainFiles.filter((f) =>
      importSpecifiers(readFileSync(f, 'utf8')).some((s) => s.includes('store')),
    );
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
