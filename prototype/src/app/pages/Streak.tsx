import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../useStore';

export function Streak() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  useEffect(() => {
    if (!user) nav('/');
  }, [user, nav]);

  const s = store.getStreak();

  return (
    <div className="page">
      <h1>坚持</h1>
      <p className="lead">这里只有你自己看得到。没有排名，没有积分，只是一个安静的记录。</p>

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="streak-num">{s.streak}</div>
        <div className="hint">连续天数</div>
        <div style={{ marginTop: 12 }} className="streak-num">
          {s.total}
        </div>
        <div className="hint">累计写下的祝福</div>
      </div>

      {s.byDay.length > 0 && (
        <div className="card">
          <h2>最近</h2>
          {s.byDay.map((d) => (
            <div key={d.date} className="meta">
              {d.date} · {d.count} 条
            </div>
          ))}
        </div>
      )}
      <p className="hint">撤回 / 删除 / 下架会即时回撤对应的计数。</p>
    </div>
  );
}
