import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ProfileView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

export function Profile() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [p, setP] = useState<ProfileView | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (user) void api.profile().then(setP);
  }, [user]);

  if (!p) return <div className={s.page}>…</div>;

  const save = (patch: Partial<ProfileView>) => {
    const next = { ...p, ...patch };
    setP(next);
    void api.saveProfile(patch).then((v) => {
      setP(v);
      setSaved(true);
    });
  };

  return (
    <div className={s.page}>
      <h1>个人空间</h1>
      <p className={s.lead}>把每次写祝福都要填的东西，在这里设一次。</p>

      <div className={s.card}>
        <label>落款（"我是谁"）</label>
        <input
          type="text"
          value={p.senderName}
          onChange={(e) => {
            setP({ ...p, senderName: e.target.value });
          }}
          onBlur={() => {
            save({ senderName: p.senderName });
          }}
        />
        <label>我的城市 / 地区</label>
        <input
          type="text"
          value={p.regionCity}
          placeholder="只到城市"
          onChange={(e) => {
            setP({ ...p, regionCity: e.target.value });
          }}
          onBlur={() => {
            save({ regionCity: p.regionCity });
          }}
        />
        <p className={s.hint}>用于"来自 XX 的祝福"。以后可以开定位自动获取。</p>
      </div>

      <div className={s.card}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
          <input
            type="checkbox"
            checked={p.locationGranted}
            onChange={(e) => {
              save({ locationGranted: e.target.checked });
            }}
          />
          用定位自动获取城市（P1 未实现，先记着你的选择）
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={p.featuredByDefault}
            onChange={(e) => {
              save({ featuredByDefault: e.target.checked });
            }}
          />
          新祝福默认允许精选展示
        </label>
      </div>

      <div className={s.card}>
        <button className="ghost" onClick={() => nav('/streak')}>
          坚持记录
        </button>{' '}
        <button className="ghost" onClick={() => nav('/compose')}>
          去写祝福
        </button>
      </div>
      {saved && <p className={s.hint}>已保存。</p>}
    </div>
  );
}
