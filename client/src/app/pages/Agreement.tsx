import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useSession } from '../session';
import { loginUrl, safeReturnTo } from '../returnTo';
import s from '../app.module.css';

export function Agreement() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'), '/give');
  const draftLost = params.get('draftLost') === '1';
  const [featured, setFeatured] = useState(true);
  const [version, setVersion] = useState('');
  const [err, setErr] = useState('');
  const [deliver, setDeliver] = useState(true);

  useEffect(() => {
    // 协议页本身也要求登录——同样带上 returnTo，登录后回到这里而不是丢回首页，
    // 才能接上"登录 + 同意协议两步之后回到原位置"这条链（kindness-entry「登录后接着走协议」）。
    if (!loading && !user) nav(loginUrl(`/agreement?returnTo=${encodeURIComponent(returnTo)}`));
  }, [loading, user, nav, returnTo]);

  useEffect(() => {
    if (user)
      void api.agreement().then((a) => {
        setVersion(a.version);
        setFeatured(a.featuredDefaultChecked);
      });
  }, [user]);

  return (
    <div className={s.page}>
      <h1>《用户内容与授权协议》</h1>
      <p className={s.lead}>协议版本 {version}。著作权仍归你。请选择你愿意授权的范围。</p>
      {draftLost && (
        <p className={s.error}>刚才写的内容这次没能暂存住，同意之后可能需要重新输入一下。</p>
      )}

      <div className={s.card}>
        <label style={{ display: 'flex', gap: 8 }}>
          <input
            type="checkbox"
            checked={deliver}
            onChange={(e) => {
              setDeliver(e.target.checked);
            }}
          />
          <span>
            <b>群发 / 送达给符合条件的陌生人</b>（必选）
            <br />
            <span className={s.hint}>
              平台获非独占许可，把这份祝福投递到你所选范围内陌生人的福袋，并通知对方。
            </span>
          </span>
        </label>
        <label style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => {
              setFeatured(e.target.checked);
            }}
          />
          <span>
            <b>平台精选展示</b>（默认跟随个人空间偏好，可取消）
            <br />
            <span className={s.hint}>允许平台在"精选""看见善意"栏目展示你的祝福。</span>
          </span>
        </label>
        {err && <div className={s.error}>{err}</div>}
        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => {
              if (!deliver) {
                setErr('不同意"送达"授权，就没法生成可分享的祝福。');
                return;
              }
              void api
                .recordConsent({
                  scopeDeliver: true,
                  scopeFeatured: featured,
                  scopeSynthesis: false,
                })
                .then(() => {
                  nav(returnTo);
                });
            }}
          >
            同意并继续
          </button>{' '}
          <button className="ghost" onClick={() => nav('/')}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
