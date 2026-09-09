// 祈福详情（/plaza/:id）：处境全文 + 稿子 + 聚合统计 + 全部 published 回应。
// 回应内容只在这里能看到（广场列表只给统计）。不展示回应者的评分细节。

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type WishRequestDetail as Detail } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function WishRequestDetail() {
  const { user } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api
      .wishRequestDetail(id)
      .then(setR)
      .catch(() => {
        setNotFound(true);
      });
  }, [id]);

  useEffect(() => {
    load();
    // 回应经过打分 + hold 才会 published，轮询等它出现（同 Inbox 的做法）
    const h = setInterval(load, 3000);
    return () => {
      clearInterval(h);
    };
  }, [load]);

  if (notFound) return <div className={s.page}>找不到这条祈福。</div>;
  if (!r) return <div className={s.page}>…</div>;

  return (
    <div className={s.page}>
      <h1>祈福</h1>
      <div className={s.card}>
        <p className={s.hint}>
          来自 {r.authorNickname}
          {r.authorCity ? ` · ${r.authorCity}` : ''}
        </p>
        <p className={s.blessing}>{r.situationText}</p>
        {r.scriptText && (
          <>
            <p className={s.hint} style={{ marginTop: 10 }}>
              TA 希望被这样念
            </p>
            <p className={s.blessing} style={{ fontStyle: 'italic' }}>
              {r.scriptText}
            </p>
          </>
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
        {r.state !== 'published' && (
          <p className={s.error} style={{ marginTop: 8 }}>
            {r.state === 'pending_review' ? '这条祈福还在人工复核中，暂未公开。' : '这条祈福已经不再公开了。'}
          </p>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        {!r.isMine && r.state === 'published' && (
          <button
            onClick={() => {
              if (!user) {
                nav('/login');
                return;
              }
              nav(`/plaza/${r.id}/respond`);
            }}
          >
            录一段祝福回应
          </button>
        )}
        {r.isMine && r.state === 'published' && (
          <button
            className="link"
            onClick={() => {
              if (confirm('撤回后这条祈福从广场消失，且不能重新发布。确定撤回？')) {
                void api.withdrawWishRequest(r.id).then(load);
              }
            }}
          >
            撤回这条祈福
          </button>
        )}
      </div>

      <h2 style={{ marginTop: 28 }}>收到的回应（{r.responseCount}）</h2>
      {r.responses.length === 0 && <p className={s.lead}>还没有人回应，再等等。</p>}
      {r.responses.map((resp) => (
        <div className={s.card} key={resp.id}>
          <p className={s.hint}>
            来自 {resp.fromNickname}
            {resp.fromCity ? ` · ${resp.fromCity}` : ''}
          </p>
          {resp.audioUrl && (
            <audio controls src={resp.audioUrl} style={{ width: '100%', marginTop: 8 }} />
          )}
          {resp.transcript && (
            <p className={s.meta} style={{ marginTop: 6 }}>
              “{resp.transcript}”
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
