import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../session';
import { safeReturnTo } from '../returnTo';
import s from '../app.module.css';

export function Login() {
  const { login } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'), '/profile');
  const draftLost = params.get('draftLost') === '1';
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className={s.page}>
      <h1>登录</h1>
      <p className={s.lead}>演示用占位登录，代替微信授权。</p>
      {draftLost && (
        <p className={s.error}>刚才写的内容这次没能暂存住，登录后可能需要重新输入一下。</p>
      )}
      <div className={s.card}>
        <label>你的昵称（别人会看到）</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
          }}
        />
        <div style={{ marginTop: 16 }}>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void login(nickname.trim() || '一位朋友')
                .then(() => {
                  nav(returnTo);
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            登录
          </button>
        </div>
        <p className={s.hint}>
          拒绝昵称授权也能登录（这里留空即可）。落款和城市登录后在个人空间里设。
        </p>
      </div>
    </div>
  );
}
