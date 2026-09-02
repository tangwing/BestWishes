import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from '../useStore';
import { STATE_LABEL } from './stateLabel';
import { OCCASION_LABEL } from '../../store/seed';

export function MyBlessings() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  useEffect(() => {
    if (!user) nav('/');
  }, [user, nav]);

  const list = store.myBlessings();

  return (
    <div className="page">
      <h1>我的祝福</h1>
      {list.length === 0 && <p className="lead">还没有写过。</p>}

      <div className="card">
        {list.map((b) => {
          const shareUrl = `${location.origin}${location.pathname}#/p/${b.slug}`;
          return (
            <div className="list-item" key={b.id}>
              <div style={{ flex: 1 }}>
                <span className={`tag ${b.state}`}>{STATE_LABEL[b.state]}</span>
                <span className="tag">{OCCASION_LABEL[b.occasion]}</span>
                <div className="body">{b.body.slice(0, 40)}{b.body.length > 40 ? '…' : ''}</div>
                <div className="meta">
                  给 {b.personalization.toName} ·{' '}
                  <a href={`#/p/${b.slug}`} target="_blank" rel="noreferrer">
                    访客视角
                  </a>
                  {b.renewCount > 0 && ` · 已续期 ${b.renewCount} 次`}
                </div>
              </div>
              <div className="actions">
                <button
                  className="ghost"
                  onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}
                >
                  复制链接
                </button>
                {(b.state === 'published' || b.state === 'verifying') && (
                  <button className="ghost" onClick={() => store.withdraw(b.id)}>
                    {b.state === 'verifying' ? '取消' : '撤回'}
                  </button>
                )}
                {b.state === 'withdrawn' && (
                  <button className="ghost" onClick={() => store.republish(b.id)}>
                    重新发布
                  </button>
                )}
                {b.state === 'expired' && (
                  <button className="ghost" onClick={() => store.renew(b.id)}>
                    续期
                  </button>
                )}
                <button
                  className="link"
                  onClick={() => {
                    if (
                      confirm(
                        '删除后不可恢复。已经送达的祝福，对方保存的截图 / 转发无法追回。确定删除？',
                      )
                    ) {
                      store.deleteBlessing(b.id);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
