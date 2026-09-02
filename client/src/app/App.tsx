// 应用外壳。迭代 1 只有占位；P1 的屏幕在后续迭代从走查原型迁移过来。

import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<'…' | 'ok' | '连不上'>('…');

  useEffect(() => {
    fetch('/healthz')
      .then((r) => {
        setHealth(r.ok ? 'ok' : '连不上');
      })
      .catch(() => {
        setHealth('连不上');
      });
  }, []);

  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 640, margin: '0 auto' }}
    >
      <h1>BestWishes</h1>
      <p style={{ color: '#6b6862' }}>练习专注，传递善意。</p>
      <p style={{ color: '#6b6862', fontSize: 13 }}>后端连接：{health}</p>
      <p style={{ color: '#9a6b4b', fontSize: 13 }}>
        P1 界面正在从走查原型迁移到这里。见 BACKLOG.md。
      </p>
    </main>
  );
}
