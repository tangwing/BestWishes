import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type WishRequestView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function WishRequestDetail() {
  const { user } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<WishRequestView | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getWishRequest(id)
      .then(setR)
      .catch(() => {
        setNotFound(true);
      });
  }, [id]);

  if (notFound) return <div className={s.page}>找不到这条请求。</div>;
  if (!r) return <div className={s.page}>…</div>;

  const isAuthor = user?.id === r.authorId;

  return (
    <div className={s.page}>
      <h1>祝福请求</h1>
      <div className={s.card}>
        <p className={s.hint}>来自 {r.authorNickname}</p>
        <p className={s.blessing}>{r.situationText}</p>
        {r.scriptText && (
          <p className={s.meta} style={{ fontStyle: 'italic' }}>
            附稿子：「{r.scriptText}」
          </p>
        )}
        {r.state !== 'published' && <p className={s.error}>这条请求已经不再公开了。</p>}
      </div>

      {isAuthor ? (
        <div style={{ marginTop: 16 }}>
          <button
            className="ghost"
            onClick={() => {
              nav(`/wish-requests/${r.id}/responses`);
            }}
          >
            查看收到的回应
          </button>
        </div>
      ) : (
        r.state === 'published' && (
          <div style={{ marginTop: 16 }}>
            <button
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
        )
      )}
    </div>
  );
}
