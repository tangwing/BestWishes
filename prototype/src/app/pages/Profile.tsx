import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../useStore';

// 个人空间：落款、城市、定位授权（P1 占位）、精选展示默认、坚持记录入口、退出登录。
export function Profile() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  const profile = store.getProfile();

  const [fromName, setFromName] = useState(profile.fromName);
  const [city, setCity] = useState(profile.city);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) nav('/');
  }, [user, nav]);
  if (!user) return null;

  function save() {
    store.saveProfile({ fromName: fromName.trim(), city: city.trim() });
    setSaved(true);
  }

  return (
    <div className="page">
      <h1>个人空间</h1>
      <p className="lead">这里设的落款和城市，会作为写祝福时的默认值。</p>

      <div className="card">
        <label>落款（别人看到的署名）</label>
        <input
          type="text"
          value={fromName}
          placeholder="如 远方的小林"
          onChange={(e) => {
            setFromName(e.target.value);
            setSaved(false);
          }}
        />

        <label>城市 / 地区</label>
        <input
          type="text"
          value={city}
          placeholder="只填到城市，如 杭州"
          onChange={(e) => {
            setCity(e.target.value);
            setSaved(false);
          }}
        />
        <p className="hint">先手填。以后可以开定位自动获取。</p>

        <div style={{ marginTop: 16 }}>
          <button onClick={save}>保存</button>{' '}
          {saved && <span className="hint">已保存</span>}
        </div>
      </div>

      <div className="card">
        <label style={{ display: 'flex', gap: 8 }}>
          <input
            type="checkbox"
            checked={profile.locationGranted}
            onChange={(e) => store.saveProfile({ locationGranted: e.target.checked })}
          />
          <span>
            允许用定位自动填城市
            <br />
            <span className="hint">P1 未实现，这个开关现在只记录你的选择。</span>
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            checked={profile.featuredByDefault}
            onChange={(e) => store.saveProfile({ featuredByDefault: e.target.checked })}
          />
          <span>
            新祝福默认开启「精选展示」
            <br />
            <span className="hint">每条祝福仍可单独调整。</span>
          </span>
        </label>
      </div>

      <div className="card">
        <Link to="/streak">坚持记录</Link>
        <p className="hint">看看你写下的祝福和连续天数。</p>
      </div>

      <button className="link" onClick={() => store.logout()}>
        退出登录
      </button>
    </div>
  );
}
