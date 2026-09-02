import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type QueueItem } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function Moderation() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reason, setReason] = useState('经人工复核');

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  const load = useCallback(() => {
    void api.queue().then(setQueue);
  }, []);
  useEffect(load, [load]);

  const resolve = (id: string, action: string) => {
    void api.resolve(id, action, reason).then(load);
  };

  return (
    <div className={s.page}>
      <h1>审核台</h1>
      <p className={s.lead}>
        队列按优先级：高危举报 &gt; 申诉 &gt; 自动疑似 &gt; 抽检。（演示：任何会话都能进）
      </p>
      <label>处理理由（写入留痕）</label>
      <input
        type="text"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
        }}
      />

      {queue.length === 0 && (
        <p className={s.lead} style={{ marginTop: 20 }}>
          队列为空。
        </p>
      )}
      <div className={s.card}>
        {queue.map((r) => (
          <div className={s.listItem} key={r.id}>
            <div style={{ flex: 1 }}>
              <span className={s.tag}>{r.origin}</span>
              <span className={s.tag}>优先级 {r.priority}</span>
              {r.blessing && (
                <span className={`${s.tag} ${s[r.blessing.state] ?? ''}`}>{r.blessing.state}</span>
              )}
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>
                {r.blessing?.body ?? '（祝福已不存在）'}
              </div>
              <div className={s.meta}>
                大类：{r.category} · 计数 {r.count}
                {r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
            <div className={s.actions}>
              <button
                onClick={() => {
                  resolve(r.id, 'pass');
                }}
              >
                通过
              </button>
              <button
                className="link"
                onClick={() => {
                  resolve(r.id, 'takedown');
                }}
              >
                下架
              </button>
              <button
                className="ghost"
                onClick={() => {
                  resolve(r.id, 'request_edit');
                }}
              >
                要求修改
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
