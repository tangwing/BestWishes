import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../useStore';

export function Home() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  const [nickname, setNickname] = useState('');

  if (user) {
    return (
      <div className="page">
        <h1>静一静，为一个人写一段祝福</h1>
        <p className="lead">
          不用急。想好要写给谁，把这一年里 TA 让你记得的一件小事，慢慢写下来。
        </p>
        <div className="card">
          <button onClick={() => nav('/compose')}>写一段祝福</button>{' '}
          <button className="ghost" onClick={() => nav('/mine')}>
            看看我写过的
          </button>
        </div>
        <p className="hint">
          这是 P1 走查原型：只做文本祝福、通过分享链接送达、暂无 AI 评估、暂无任何资金功能。
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>BestWishes</h1>
      <p className="lead">练习专注，传递善意。为世界上的某个人，认真写一段祝福。</p>
      <div className="card">
        <h2>登录（原型用占位登录，代替微信授权）</h2>
        <label>你的昵称</label>
        <input
          type="text"
          value={nickname}
          placeholder="别人会看到"
          onChange={(e) => setNickname(e.target.value)}
        />
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              store.loginStub(nickname.trim() || '一位朋友', '');
              nav('/');
            }}
          >
            登录
          </button>
        </div>
        <p className="hint">
          拒绝昵称授权也能登录（这里留空即可）——对应 wx-account「可选的资料授权」。
          城市在个人空间里设。
        </p>
      </div>
    </div>
  );
}
