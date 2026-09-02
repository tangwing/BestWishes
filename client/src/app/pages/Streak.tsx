import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type StreakView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function Streak() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [v, setV] = useState<StreakView | null>(null);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);
  useEffect(() => {
    if (user) void api.streak().then(setV);
  }, [user]);

  if (!v) return <div className={s.page}>…</div>;

  return (
    <div className={s.page}>
      <h1>坚持</h1>
      <p className={s.lead}>这里只有你自己看得到。没有排名，没有积分，只是一个安静的记录。</p>
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div className="breathe" />
        <div className={s.streakNum}>{v.streak}</div>
        <div className={s.hint}>连续天数</div>
        <div className={s.streakNum} style={{ marginTop: 12 }}>
          {v.total}
        </div>
        <div className={s.hint}>累计写下的祝福</div>
      </div>
      {v.byDay.length > 0 && (
        <div className={s.card}>
          <h2>最近</h2>
          {v.byDay.map((d) => (
            <div key={d.date} className={s.meta}>
              {d.date} · {d.count} 条
            </div>
          ))}
        </div>
      )}
      <p className={s.hint}>撤回 / 删除 / 下架会即时回撤对应计数。</p>
    </div>
  );
}
