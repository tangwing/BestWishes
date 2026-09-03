import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type InboxItem } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const OCC: Record<string, string> = {
  birthday: '生日',
  festival: '节日',
  encouragement: '鼓励',
  recovery: '康复祈愿',
  remembrance: '纪念 / 追思',
  daily: '日常问候',
};

function distanceLabel(km: number | null): string {
  if (km === null) return '';
  if (km < 1) return ' · 就在附近';
  return ` · 约 ${String(Math.round(km))} km 外`;
}

export function Inbox() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    void api.inbox().then(setItems);
    // 进收件箱即把通知标记为已读
    void api.markNotificationsRead();
    void api.markInboxRead();
  }, [user]);

  return (
    <div className={s.page}>
      <h1>收件箱</h1>
      <p className={s.lead}>陌生人送给你的祝福。你不能和对方对话，但可以回一段祝福过去。</p>

      {items.length === 0 && (
        <div className={s.card}>
          <p className={s.lead}>还没有收到祝福。</p>
          <p className={s.hint}>
            把个人空间的位置、标签填清楚，别人按条件群发时就更可能筛到你。
          </p>
        </div>
      )}

      {items.map((it) => (
        <div className={s.card} key={it.id}>
          <p className={s.hint}>
            来自 {it.from.nickname}
            {it.from.city ? ` · ${it.from.city}` : ''}
            {distanceLabel(it.from.distanceKm)} · {OCC[it.occasion] ?? it.occasion}
          </p>
          {it.status === 'content' && it.body ? (
            <p className={s.blessing}>{it.body}</p>
          ) : (
            <p className={s.lead}>{it.placeholderText ?? '这份祝福暂时无法查看'}</p>
          )}
          {it.canReply && (
            <div style={{ marginTop: 10 }}>
              <button
                className="ghost"
                onClick={() => {
                  nav(
                    `/compose?replyTo=${encodeURIComponent(it.from.userId)}&to=${encodeURIComponent(
                      it.from.nickname,
                    )}`,
                  );
                }}
              >
                回一段祝福
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
