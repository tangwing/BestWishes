import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function Agreement() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [featured, setFeatured] = useState(true);
  const [version, setVersion] = useState('');
  const [err, setErr] = useState('');
  const [deliver, setDeliver] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

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
            <b>送达 / 展示给被分享人</b>（必选）
            <br />
            <span className={s.hint}>平台获非独占许可，把这份祝福送到你分享的人手里。</span>
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
                  nav('/compose');
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
