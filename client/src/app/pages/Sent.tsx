import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type OutboxItem } from '../../api/client';
import s from '../app.module.css';

const STATE_LABEL: Record<string, string> = {
  verifying: '审核中',
  published: '已送达',
  rejected: '未通过',
  taken_down: '已下架',
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

  const shareUrl = `${location.origin}/p/${item.slug}`;
  const visible = item.state === 'published';

  return (
    <div className={s.page}>
      <h1>已发送 ✓</h1>
      <p className={s.lead}>
        你的心意正在送往 <b>{item.toName}</b>。
        {visible
          ? ' 校验已通过，现在对方打开链接就能看到。'
          : item.state === 'verifying'
            ? ' 平台正在做一次内容校验（通常几分钟），通过后对方才会看到。'
            : ' 这次没有通过校验。'}
      </p>

      <div className={s.card}>
        <span className={`${s.tag} ${s[item.state] ?? ''}`}>
          {STATE_LABEL[item.state] ?? item.state}
        </span>
        <p className={s.blessing} style={{ fontSize: 16 }}>
          {item.bodyPreview}
        </p>
        <p className={s.meta}>给 {item.toName}</p>
      </div>

      <div className={s.card}>
        <h2>分享这份祝福</h2>
        <p className={s.hint} style={{ wordBreak: 'break-all' }}>
          {shareUrl}
        </p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl);
          }}
        >
          复制链接
        </button>{' '}
        <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer">
          <button className="ghost">以访客视角打开</button>
        </a>
      </div>

      <p>
        <Link to="/records">去「收发记录」管理</Link> · <Link to="/compose">再写一段</Link>
      </p>
    </div>
  );
}
