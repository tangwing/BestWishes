import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type OutboxItem } from '../../api/client';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  verifying: '校验中',
  published: '已送达',
  rejected: '未通过',
  taken_down: '已下架',
  withdrawn: '已撤回',
};

export function Sent() {
  const { id } = useParams();
  const [item, setItem] = useState<OutboxItem | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      void api.outbox().then((list) => {
        if (!active) return;
        setItem(list.find((b) => b.id === id) ?? null);
      });
    };
    tick();
    const h = setInterval(tick, 2000);
    return () => {
      active = false;
      clearInterval(h);
    };
  }, [id]);

  if (!item) return <div className={s.page}>…</div>;

  const n = item.recipientCount;
  const target = item.scope === 'reply' ? '对方' : `${n} 位陌生人`;

  return (
    <div className={s.page}>
      <h1>已发送 ✓</h1>
      <p className={s.lead}>
        你的心意正在送往 <b>{target}</b>。
        {item.state === 'published'
          ? ' 校验已通过，已经进了 TA 们的收件箱。'
          : item.state === 'verifying'
            ? ' 平台正在做一次内容校验（通常几分钟），通过后才会投递并通知对方。'
            : ' 这次没有通过校验。'}
      </p>

      <div className={s.card}>
        <span className={`${s.tag} ${s[item.state] ?? ''}`}>
          {STATE_LABEL[item.state] ?? item.state}
        </span>
        <p className={s.blessing} style={{ fontSize: 16 }}>
          {item.bodyPreview}
        </p>
        <p className={s.meta}>{item.scope === 'reply' ? '回复给一个人' : `群发 · ${n} 人`}</p>
      </div>

      <div className={s.card}>
        <h2>把 BestWishes 讲给朋友</h2>
        <p className={s.hint}>
          这份祝福有一个公开链接，可以转发到微信，让更多人来这里给陌生人写祝福。
          （祝福本身已经进了收件人的收件箱，不需要靠链接送达。）
        </p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(`${location.origin}/p/${item.slug}`);
          }}
        >
          复制公开链接
        </button>{' '}
        <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer">
          <button className="ghost">打开看看</button>
        </a>
      </div>

      <p>
        <Link to="/records">去「发出的」管理</Link> · <Link to="/compose">再写一段</Link>
      </p>
    </div>
  );
}
