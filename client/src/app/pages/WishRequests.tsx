import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type WishRequestView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function WishRequests() {
  const { user } = useSession();
  const nav = useNavigate();
  const [list, setList] = useState<WishRequestView[]>([]);

  useEffect(() => {
    void api.wishRequestPlaza().then(setList);
  }, []);

  return (
    <div className={s.page}>
      <h1>祝福请求广场</h1>
      <p className={s.lead}>
        有人正处在某种心情里，写下了自己的处境，希望有人送一段祝福回去——可以照他附的稿子念，也可以自己说。
      </p>
      {user && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => {
              nav('/wish-requests/new');
            }}
          >
            发布一条请求
          </button>
        </div>
      )}

      {list.length === 0 && <p className={s.lead}>广场上还没有请求。</p>}

      {list.map((r) => (
        <div className={s.card} key={r.id}>
          <p className={s.hint}>来自 {r.authorNickname}</p>
          <p className={s.blessing}>{r.situationText}</p>
          {r.scriptText && (
            <p className={s.meta} style={{ fontStyle: 'italic' }}>
              附稿子：「{r.scriptText}」
            </p>
          )}
          {r.tags.length > 0 && (
            <div className={s.tabs} style={{ marginTop: 8 }}>
              {r.tags.map((t) => (
                <span key={t} className={s.tab}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              className="ghost"
              onClick={() => {
                if (!user) {
                  nav('/login');
                  return;
                }
                nav(`/wish-requests/${r.id}/respond`);
              }}
            >
              录一段祝福回应
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
