// 祈福广场：所有人的祈福（Topic）列表。只展示摘要 + 聚合统计——
// 回应内容点进详情页（/plaza/:id）才看得到。"我的祈福"是这里的一个筛选项。

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type WishRequestSummary } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  published: '公开中',
  pending_review: '审核中',
  withdrawn: '已撤回',
  deleted: '已删除',
};

function lastActivity(iso: string | null): string {
  if (!iso) return '还没有回应';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return '今天有新回应';
  if (days === 1) return '昨天有回应';
  return `${days} 天前有回应`;
}

export function WishRequests() {
  const { user } = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') === 'mine' ? 'mine' : 'all';
  const [list, setList] = useState<WishRequestSummary[]>([]);

  const load = useCallback(() => {
    void api.plaza(filter).then(setList).catch(() => setList([]));
  }, [filter]);

  useEffect(load, [load]);

  return (
    <div className={s.page}>
      <h1>祈福广场</h1>
      <p className={s.lead}>
        有人正处在某种心情里，写下了自己的处境，盼着有人送一段祝福回去。点进去看回应，或者自己录一段。
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        {user && (
          <button
            onClick={() => {
              nav('/plaza/new');
            }}
          >
            发布一条祈福
          </button>
        )}
        {user && (
          <div className={s.tabs}>
            <span
              className={`${s.tab} ${filter === 'all' ? s.on : ''}`}
              onClick={() => {
                setParams({});
              }}
            >
              全部
            </span>
            <span
              className={`${s.tab} ${filter === 'mine' ? s.on : ''}`}
              onClick={() => {
                setParams({ filter: 'mine' });
              }}
            >
              我的祈福
            </span>
          </div>
        )}
      </div>

      {list.length === 0 && (
        <p className={s.lead}>{filter === 'mine' ? '你还没有发布过祈福。' : '广场上还没有祈福。'}</p>
      )}

      {list.map((r) => (
        <div
          className={s.card}
          key={r.id}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            nav(`/plaza/${r.id}`);
          }}
        >
          <p className={s.hint}>
            来自 {r.authorNickname}
            {r.authorCity ? ` · ${r.authorCity}` : ''}
            {filter === 'mine' && (
              <>
                {' · '}
                <span className={s.tag}>{STATE_LABEL[r.state] ?? r.state}</span>
              </>
            )}
          </p>
          <p className={s.blessing}>{r.situationExcerpt}</p>
          {r.tags.length > 0 && (
            <div className={s.tabs} style={{ marginTop: 8 }}>
              {r.tags.map((t) => (
                <span key={t} className={s.tab}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className={s.meta} style={{ marginTop: 8 }}>
            已收到 <b>{r.responseCount}</b> 条回应 · {lastActivity(r.lastResponseAt)}
          </p>
          {filter === 'mine' && r.state === 'published' && (
            <div style={{ marginTop: 8 }}>
              <button
                className="link"
                onClick={(e) => {
                  e.stopPropagation();
                  void api.withdrawWishRequest(r.id).then(load);
                }}
              >
                撤回
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
