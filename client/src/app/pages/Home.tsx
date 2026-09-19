// 首页：把"激发"前置到第一屏——不是一个人口筛选器，是一条真实祈福 + 别人给出的真实回应。
// 对访客与登录用户呈现一致的内容（见 kindness-entry spec「首屏呈现真实的善意」）。

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type WishRequestSummary } from '../../api/client';
import s from '../app.module.css';

export function Home() {
  const nav = useNavigate();
  const [list, setList] = useState<WishRequestSummary[] | null>(null);

  useEffect(() => {
    void api
      .plaza('all')
      .then(setList)
      .catch(() => {
        setList([]);
      });
  }, []);

  if (list === null) return <div className={s.page}>…</div>;

  // 优先展示"最近有回应"的一条——同时能看到需求和善意两侧；没有的话退而求其次展示最新一条。
  const featured = list.find((r) => r.lastResponseExcerpt !== null) ?? list[0] ?? null;

  return (
    <div className={s.page}>
      <h1>BestWishes</h1>
      <p className={s.lead}>练习专注，传播善意。这里没有聊天，只有一来一回、认真写给具体的人的祝福。</p>

      {featured ? (
        <div className={s.card}>
          <p className={s.hint}>
            来自 {featured.authorNickname}
            {featured.authorCity ? ` · ${featured.authorCity}` : ''}
          </p>
          <p className={s.blessing}>{featured.situationExcerpt}</p>
          {featured.lastResponseExcerpt ? (
            <>
              <p className={s.hint} style={{ marginTop: 12 }}>有人已经这样回应 TA</p>
              <p className={s.blessing} style={{ fontSize: 15 }}>“{featured.lastResponseExcerpt}”</p>
            </>
          ) : (
            <p className={s.hint} style={{ marginTop: 12 }}>还没有人回应，第一句可能就是你的。</p>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                nav(`/plaza/${featured.id}/respond`);
              }}
            >
              回应这条祈福
            </button>
            <Link to={`/plaza/${featured.id}`}>
              <button className="ghost">看完整的回应</button>
            </Link>
          </div>
        </div>
      ) : (
        <div className={s.card}>
          <p className={s.lead}>广场上还没有祈福，第一条可以是你的。</p>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/plaza/new">
          <button>发布一条祈福</button>
        </Link>
        <Link to="/give">
          <button className="ghost">给附近的人写一段祝福</button>
        </Link>
      </div>
    </div>
  );
}
