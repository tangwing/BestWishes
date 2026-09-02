import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStore } from '../useStore';
import { STATE_LABEL } from './stateLabel';
import { OCCASION_LABEL } from '../../store/seed';

type Tab = 'sent' | 'received';

export function MyBlessings() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  const [tab, setTab] = useState<Tab>('sent');
  useEffect(() => {
    if (!user) nav('/');
  }, [user, nav]);

  const list = store.myBlessings();

  return (
    <div className="page">
      <h1>收发记录</h1>

      <div className="nav" style={{ gap: 4, marginBottom: 12 }}>
        <button className={tab === 'sent' ? '' : 'ghost'} onClick={() => setTab('sent')}>
          送出的
        </button>
        <button
          className={tab === 'received' ? '' : 'ghost'}
          onClick={() => setTab('received')}
        >
          收到的
        </button>
      </div>

      {tab === 'received' && (
        <div className="card">
          <p className="lead">这里还是空的。</p>
          <p className="hint">
            你写给别人的祝福通过链接送达；站内收发要等 P2 的主动赠送和祝福请求。
          </p>
        </div>
      )}

      {tab === 'sent' && (
        <>
          {list.length === 0 && <p className="lead">还没有写过。</p>}
          <div className="card">
            {list.map((b) => {
              const shareUrl = `${location.origin}${location.pathname}#/p/${b.slug}`;
              return (
                <div className="list-item" key={b.id}>
                  <div style={{ flex: 1 }}>
                    <span className={`tag ${b.state}`}>{STATE_LABEL[b.state]}</span>
                    <span className="tag">{OCCASION_LABEL[b.occasion]}</span>
                    <div className="body">
                      {b.body.slice(0, 40)}
                      {b.body.length > 40 ? '…' : ''}
                    </div>
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
        </>
      )}
    </div>
  );
}
