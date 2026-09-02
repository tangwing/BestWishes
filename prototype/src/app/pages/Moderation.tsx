import { useState } from 'react';
import { useStore } from '../useStore';
import { STATE_LABEL } from './stateLabel';

export function Moderation() {
  const store = useStore();
  const queue = store.moderationQueue();
  const [reason, setReason] = useState('经人工复核');

  return (
    <div className="page">
      <h1>审核台</h1>
      <p className="lead">
        原型里所有人都能进（真实产品按角色鉴权）。队列按优先级：高危举报 &gt; 申诉 &gt; 自动疑似 &gt; 抽检。
      </p>

      <label>处理理由（写入留痕）</label>
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />

      {queue.length === 0 && <p className="lead" style={{ marginTop: 20 }}>队列为空。</p>}

      <div className="card">
        {queue.map((r) => {
          const b = store.blessingById(r.blessingId);
          return (
            <div className="list-item" key={r.id}>
              <div style={{ flex: 1 }}>
                <span className="tag">{r.origin}</span>
                <span className="tag">优先级 {r.priority}</span>
                {b && <span className={`tag ${b.state}`}>{STATE_LABEL[b.state]}</span>}
                <div className="body">{b?.body ?? '（祝福已不存在）'}</div>
                <div className="meta">
                  大类：{String(r.category)} · 计数 {r.count}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
                <div className="meta">
                  {r.timeline.map((t, i) => (
                    <div key={i}>· {t.text}</div>
                  ))}
                </div>
              </div>
              <div className="actions">
                <button onClick={() => store.resolveReport(r.id, 'pass', reason)}>通过</button>
                <button className="link" onClick={() => store.resolveReport(r.id, 'takedown', reason)}>
                  下架
                </button>
                <button
                  className="ghost"
                  onClick={() => store.resolveReport(r.id, 'request_edit', reason)}
                >
                  要求修改
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
