import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../useStore';

export function Agreement() {
  const store = useStore();
  const nav = useNavigate();
  const agreement = store.getAgreement();
  const [deliver, setDeliver] = useState(true);
  const [featured, setFeatured] = useState(agreement.featuredDefaultOn);
  const [synthesis] = useState(false);
  const [err, setErr] = useState('');

  const noUser = !store.currentUser();
  useEffect(() => {
    if (noUser) nav('/');
  }, [noUser, nav]);
  if (noUser) return null;

  return (
    <div className="page">
      <h1>《用户内容与授权协议》</h1>
      <p className="lead">协议版本 {agreement.version}。请选择你愿意授权的范围。</p>

      <div className="card">
        <label style={{ display: 'flex', gap: 8 }}>
          <input type="checkbox" checked={deliver} onChange={(e) => setDeliver(e.target.checked)} />
          <span>
            <b>送达 / 展示给被分享人</b>（必选）
            <br />
            <span className="hint">著作权仍归你。平台获非独占许可，用于把这份祝福送到你分享的人手里。</span>
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          <span>
            <b>平台精选展示</b>
            {agreement.featuredDefaultOn ? '（默认开启，可取消）' : '（默认关闭，可开启）'}
            <br />
            <span className="hint">
              允许平台在"精选""看见善意"等栏目展示你的祝福。可随时在祝福详情里关闭。
            </span>
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, marginTop: 16, opacity: 0.6 }}>
          <input type="checkbox" checked={synthesis} disabled />
          <span>
            <b>未来音视频合成 / 演绎</b>（P1 不涉及，仅告知）
          </span>
        </label>

        {err && <div className="error">{err}</div>}

        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => {
              if (!deliver) {
                setErr('不同意"送达"授权就无法生成可分享的祝福。');
                return;
              }
              store.recordConsent({ featured, synthesis });
              nav('/compose');
            }}
          >
            同意并继续
          </button>{' '}
          <button className="ghost" onClick={() => nav('/')}>
            返回
          </button>
        </div>
      </div>
      <p className="hint">
        每次同意都会留痕（版本、时间、逐项选择）。协议改版后下次创作会要求重新确认。
      </p>
    </div>
  );
}
