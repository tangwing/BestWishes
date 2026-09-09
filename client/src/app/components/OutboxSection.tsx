// "我的善意"——当前用户发出的祝福 + 状态 + 管理操作。
// 原「发件箱」页（Records.tsx），B-71 后并入「传递善意」页（/give）作为下半部分。

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type OutboxItem } from '../../api/client';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  verifying: '校验中',
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

export function OutboxSection() {
  const nav = useNavigate();
  const [list, setList] = useState<OutboxItem[]>([]);

  const load = useCallback(() => {
    void api.outbox().then(setList);
  }, []);
  useEffect(load, [load]);

  const act = (fn: Promise<unknown>) => {
    void fn.then(load);
  };

  return (
    <>
      <h2 style={{ marginTop: 32 }}>我的善意</h2>
      <p className={s.hint}>你群发和回复出去的祝福，以及它们现在的状态。</p>
      <div className={s.card}>
        {list.length === 0 && <p className={s.lead}>还没有传递过。</p>}
        {list.map((b) => (
          <div className={s.listItem} key={b.id}>
            <div style={{ flex: 1 }}>
              <span className={`${s.tag} ${s[b.state] ?? ''}`}>
                {STATE_LABEL[b.state] ?? b.state}
              </span>
              <span className={s.tag}>{OCC[b.occasion]}</span>
              <span className={s.tag}>
                {b.scope === 'reply' ? '回复' : `群发 ${b.recipientCount} 人`}
              </span>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{b.bodyPreview}</div>
              <div className={s.meta}>
                <a href={`/p/${b.slug}`} target="_blank" rel="noreferrer">
                  公开链接
                </a>
                {b.renewCount > 0 && ` · 已续期 ${String(b.renewCount)} 次`}
              </div>
            </div>
            <div className={s.actions}>
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
                    nav('/give', { state: { copyBody: b.body, copyOccasion: b.occasion } });
                  }}
                >
                  复制以供编辑
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
                    confirm('删除后不可恢复。已送达的祝福，对方福袋里的那份不受影响。确定删除？')
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
    </>
  );
}
