import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type WishRequestView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  published: '公开中',
  withdrawn: '已撤回',
  deleted: '已删除',
};

export function MyWishRequests() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [list, setList] = useState<WishRequestView[]>([]);

  const load = useCallback(() => {
    void api.myWishRequests().then(setList);
  }, []);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(load, [load]);

  return (
    <div className={s.page}>
      <h1>我发布的请求</h1>
      {list.length === 0 && <p className={s.lead}>还没有发布过请求。</p>}
      {list.map((r) => (
        <div className={s.listItem} key={r.id}>
          <div style={{ flex: 1 }}>
            <span className={s.tag}>{STATE_LABEL[r.state] ?? r.state}</span>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{r.situationText}</div>
          </div>
          <div className={s.actions}>
            <button
              className="ghost"
              onClick={() => {
                nav(`/wish-requests/${r.id}/responses`);
              }}
            >
              查看回应
            </button>
            {r.state === 'published' && (
              <button
                className="link"
                onClick={() => {
                  void api.withdrawWishRequest(r.id).then(load);
                }}
              >
                撤回
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
