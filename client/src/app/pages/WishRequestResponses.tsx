import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ResponseSummary } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function WishRequestResponses() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<ResponseSummary[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    // 回应要经过打分 + hold 才会 published，一次性 fetch 会在还没发布时永远显示"还没有人回应"
    // （P1 的 Inbox 页踩过同一个坑：见 PROMPT_LOG），这里同样改成轮询。
    const tick = () => {
      void api
        .wishRequestResponses(id)
        .then((r) => {
          if (active) setList(r);
        })
        .catch(() => {
          if (active) setErr('没有权限查看，或这条请求不存在。');
        });
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(h);
    };
  }, [id, user]);

  return (
    <div className={s.page}>
      <h1>收到的回应</h1>
      <p className={s.lead}>不设数量上限，全部列在这里，按最新排在前面。</p>
      {err && <p className={s.error}>{err}</p>}
      {list.length === 0 && !err && <p className={s.lead}>还没有人回应，再等等。</p>}
      {list.map((r) => (
        <div className={s.card} key={r.id}>
          <p className={s.hint}>
            来自 {r.fromNickname}
            {r.fromCity ? ` · ${r.fromCity}` : ''}
          </p>
          {r.audioUrl && <audio controls src={r.audioUrl} style={{ width: '100%', marginTop: 8 }} />}
        </div>
      ))}
    </div>
  );
}
