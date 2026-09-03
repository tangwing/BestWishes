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
      <h1>回响</h1>
      <p className={s.lead}>
        送人玫瑰，手有余香。你写给别人的每一句祝福，也在你自己心里留下一点什么。
        这里只有你看得到，没有排名，没有积分。
      </p>
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div className="breathe" />
        <div className={s.streakNum}>{v.total}</div>
        <div className={s.hint}>你送出的心意</div>
        {v.streak > 0 && (
          <div className={s.hint} style={{ marginTop: 12 }}>
            最近 {v.streak} 天，每天都想起了别人
          </div>
        )}
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
      <p className={s.hint}>撤回 / 删除 / 下架会即时回撤对应计数；链接过期不影响。</p>
    </div>
  );
}
