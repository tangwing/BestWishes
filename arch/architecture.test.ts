// 架构测试。dependency-cruiser（.dependency-cruiser.cjs）是主检查，
// 这里加几条它不好表达的断言。跑：pnpm test:arch（含 depcruise + 本文件）。

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '..');

function walk(dir: string, filter: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(name)) out.push(full);
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const spec = m[1] ?? m[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

const domainSrc = join(REPO, 'packages/domain/src');
const domainFiles = walk(domainSrc, (n) => /\.ts$/.test(n) && !/\.test\.ts$/.test(n));

describe('领域层保持纯净', () => {
  it('有领域文件可检查', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  it('不 import 框架 / 其它包 / Node 内建', () => {
    const forbidden = /^(react|react-|fastify|zod|@bestwishes\/|node:)/;
    const bad: string[] = [];
    for (const file of domainFiles) {
      for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (forbidden.test(spec) || ['fs', 'path', 'crypto', 'os', 'net', 'http'].includes(spec)) {
          bad.push(`${relative(REPO, file)} → ${spec}`);
        }
      }
    }
    expect(bad, `领域层出现不该有的依赖:\n${bad.join('\n')}`).toEqual([]);
  });

  it('不用 Date.now() / Math.random()（时间和随机数靠参数传进来）', () => {
    const bad: string[] = [];
    for (const file of domainFiles) {
      const src = readFileSync(file, 'utf8');
      if (/\bDate\.now\s*\(/.test(src)) bad.push(`${relative(REPO, file)}: Date.now()`);
      if (/\bMath\.random\s*\(/.test(src)) bad.push(`${relative(REPO, file)}: Math.random()`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

describe('server 分层：依赖只指向内层', () => {
  const serverSrc = join(REPO, 'server/src');
  const serverFiles = walk(serverSrc, (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n));

  it('application 不 import infrastructure / interface', () => {
    const bad: string[] = [];
    for (const file of serverFiles) {
      const rel = relative(serverSrc, file);
      if (!rel.startsWith('application/')) continue;
      for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (spec.includes('infrastructure') || spec.includes('interface')) {
          bad.push(`${rel} → ${spec}`);
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
