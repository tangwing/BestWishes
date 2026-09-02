import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../useStore';
import { STATE_LABEL } from './stateLabel';

export function Sent() {
  const store = useStore();
  const { id } = useParams();
  const nav = useNavigate();
  const b = id ? store.blessingById(id) : null;

  if (!b) return <div className="page">找不到这条祝福。</div>;

  const shareUrl = `${location.origin}${location.pathname}#/p/${b.slug}`;
  const visible = b.state === 'published';

  return (
    <div className="page">
      <h1>已发送 ✓</h1>
      <p className="lead">
        你的祝福已经交给平台。
        {visible
          ? ' 校验已通过，现在对方打开链接就能看到。'
          : b.state === 'verifying'
            ? ' 平台正在做一次内容校验（通常几分钟），通过后对方才会看到。'
            : b.state === 'rejected'
              ? ' 这次没有通过校验，你可以修改后再发，或提交申诉。'
              : ''}
      </p>

      <div className="card">
        <span className={`tag ${b.state}`}>{STATE_LABEL[b.state]}</span>
        <p className="blessing" style={{ fontSize: 16 }}>
          {b.body}
        </p>
        <p className="meta">给 {b.personalization.toName}</p>
      </div>

      <div className="card">
        <h2>分享这份祝福</h2>
        <p className="hint" style={{ wordBreak: 'break-all' }}>{shareUrl}</p>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl).catch(() => {});
          }}
        >
          复制链接
        </button>{' '}
        <a href={`#/p/${b.slug}`} target="_blank" rel="noreferrer">
          <button className="ghost">以访客视角打开</button>
        </a>
        <p className="hint">
          （原型说明：真实产品这里调起微信分享；非微信环境用"复制链接"兜底。）
        </p>
      </div>

      <p>
        <Link to="/mine">前往"收发记录"管理</Link> ·{' '}
        <button className="link" onClick={() => nav('/compose')}>
          再写一段
        </button>
      </p>
      {!visible && b.state === 'verifying' && (
        <p className="hint">状态会自动刷新。用上方"走查工具"的「+7 秒」可跳过 hold。</p>
      )}
    </div>
  );
}
