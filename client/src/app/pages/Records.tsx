import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type OutboxItem } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  verifying: '审核中',
  published: '已送达',
  rejected: '未通过',
  taken_down: '已下架',
  withdrawn: '已撤回',
  expired: '已过期',
};
const OCC: Record<string, string> = {
  birthday: '生日',
  festival: '节日',
  encouragement: '鼓励',
  recovery: '康复祈愿',
  remembrance: '纪念 / 追思',
  daily: '日常问候',
};

export function Records() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [list, setList] = useState<OutboxItem[]>([]);
  const [inboxNote, setInboxNote] = useState('');

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  const load = useCallback(() => {
    void api.outbox().then(setList);
    void api.inbox().then((i) => {
      setInboxNote(i.note);
    });
  }, []);
  useEffect(load, [load]);

  const act = (fn: Promise<unknown>) => {
    void fn.then(load);
  };

  return (
    <div className={s.page}>
      <h1>收发记录</h1>
      <div className={s.tabs}>
        <span
          className={`${s.tab} ${tab === 'sent' ? s.on : ''}`}
          onClick={() => {
            setTab('sent');
          }}
        >
          送出的
        </span>
        <span
          className={`${s.tab} ${tab === 'received' ? s.on : ''}`}
          onClick={() => {
            setTab('received');
          }}
        >
          收到的
        </span>
      </div>

      {tab === 'received' && (
        <div className={s.card}>
          <p className={s.lead}>这里还是空的。</p>
          <p className={s.hint}>{inboxNote}</p>
        </div>
      )}

      {tab === 'sent' && (
        <div className={s.card}>
          {list.length === 0 && <p className={s.lead}>还没有写过。</p>}
          {list.map((b) => (
            <div className={s.listItem} key={b.id}>
              <div style={{ flex: 1 }}>
                <span className={`${s.tag} ${s[b.state] ?? ''}`}>
                  {STATE_LABEL[b.state] ?? b.state}
                </span>
                <span className={s.tag}>{OCC[b.occasion]}</span>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{b.bodyPreview}</div>
                <div className={s.meta}>
                  给 {b.toName} ·{' '}
                  <a href={`/p/${b.slug}`} target="_blank" rel="noreferrer">
                    访客视角
                  </a>
                  {b.renewCount > 0 && ` · 已续期 ${String(b.renewCount)} 次`}
                </div>
              </div>
              <div className={s.actions}>
                <button
                  className="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${location.origin}/p/${b.slug}`);
                  }}
                >
                  复制链接
                </button>
                {(b.state === 'published' || b.state === 'verifying') && (
                  <button
                    className="ghost"
                    onClick={() => {
                      act(api.withdraw(b.id));
                    }}
                  >
                    {b.state === 'verifying' ? '取消' : '撤回'}
                  </button>
                )}
                {b.state === 'withdrawn' && (
                  <button
                    className="ghost"
                    onClick={() => {
                      act(api.republish(b.id));
                    }}
                  >
                    重新发布
                  </button>
                )}
                {b.state === 'expired' && (
                  <button
                    className="ghost"
                    onClick={() => {
                      act(api.renew(b.id));
                    }}
                  >
                    续期
                  </button>
                )}
                <button
                  className="link"
                  onClick={() => {
                    if (
                      confirm(
                        '删除后不可恢复。已送达的祝福，对方保存的截图 / 转发无法追回。确定删除？',
                      )
                    ) {
                      act(api.remove(b.id));
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className={s.hint}>撤回 / 删除 / 下架会即时回撤坚持记录；链接过期不回撤。</p>
    </div>
  );
}
