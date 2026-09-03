import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Gender, type ProfileView } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const GENDERS: [Gender | 'unset', string][] = [
  ['male', '男'],
  ['female', '女'],
  ['other', '其他'],
  ['unset', '不设'],
];

const CURRENT_YEAR = new Date().getFullYear();

export function Profile() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [p, setP] = useState<ProfileView | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoErr, setGeoErr] = useState('');

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    void api.profile().then(setP);
    void api.suggestedTags().then((r) => {
      setSuggested(r.tags);
    });
  }, [user]);

  if (!p) return <div className={s.page}>…</div>;

  const save = (patch: Partial<ProfileView>) => {
    setP({ ...p, ...patch });
    void api.saveProfile(patch).then((v) => {
      setP(v);
      setSaved(true);
    });
  };

  const useBrowserLocation = () => {
    setGeoErr('');
    if (!('geolocation' in navigator)) {
      setGeoErr('这个浏览器不支持定位');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        save({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          locationGranted: true,
        });
      },
      (e) => {
        setGeoBusy(false);
        setGeoErr(`定位失败：${e.message}。可以手动填经纬度。`);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const toggleTag = (tag: string) => {
    const has = p.tags.includes(tag);
    save({ tags: has ? p.tags.filter((x) => x !== tag) : [...p.tags, tag] });
  };

  return (
    <div className={s.page}>
      <h1>个人空间</h1>
      <p className={s.lead}>
        这是别人给你送祝福时能筛到的画像。填得越清楚，越可能收到贴近你的祝福。
      </p>

      <div className={s.card}>
        <label>昵称 / 落款（别人会看到）</label>
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
        <label>城市 / 地区（显示用，只到城市）</label>
        <input
          type="text"
          value={p.regionCity}
          placeholder="如 杭州"
          onChange={(e) => {
            setP({ ...p, regionCity: e.target.value });
          }}
          onBlur={() => {
            save({ regionCity: p.regionCity });
          }}
        />
      </div>

      <div className={s.card}>
        <h2>位置</h2>
        <p className={s.hint}>
          用于按距离筛选。只存经纬度，别人看到的只有城市和大致距离，看不到精确位置。
        </p>
        <button className="ghost" disabled={geoBusy} onClick={useBrowserLocation}>
          {geoBusy ? '定位中…' : '用浏览器定位'}
        </button>
        <div className={s.row} style={{ marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label>纬度 lat</label>
            <input
              type="number"
              step="0.00001"
              aria-label="纬度"
              value={p.lat ?? ''}
              onChange={(e) => {
                setP({ ...p, lat: e.target.value === '' ? null : Number(e.target.value) });
              }}
              onBlur={() => {
                save({ lat: p.lat });
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>经度 lng</label>
            <input
              type="number"
              step="0.00001"
              aria-label="经度"
              value={p.lng ?? ''}
              onChange={(e) => {
                setP({ ...p, lng: e.target.value === '' ? null : Number(e.target.value) });
              }}
              onBlur={() => {
                save({ lng: p.lng });
              }}
            />
          </div>
        </div>
        {geoErr && <p className={s.error}>{geoErr}</p>}
        {p.canBroadcast ? (
          <p className={s.hint}>位置已设置，可以群发。</p>
        ) : (
          <p className={s.hint}>还没设置位置——群发和被别人筛到都需要它。</p>
        )}
      </div>

      <div className={s.card}>
        <h2>性别</h2>
        <div className={s.tabs}>
          {GENDERS.map(([g, label]) => {
            const on = g === 'unset' ? p.gender === null : p.gender === g;
            return (
              <span
                key={g}
                className={`${s.tab} ${on ? s.on : ''}`}
                onClick={() => {
                  save({ gender: g === 'unset' ? null : g });
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <label style={{ marginTop: 14 }}>出生年份</label>
        <input
          type="number"
          min={1900}
          max={CURRENT_YEAR}
          placeholder="如 1996"
          value={p.birthYear ?? ''}
          onChange={(e) => {
            setP({ ...p, birthYear: e.target.value === '' ? null : Number(e.target.value) });
          }}
          onBlur={() => {
            save({ birthYear: p.birthYear });
          }}
        />
      </div>

      <div className={s.card}>
        <h2>标签</h2>
        <p className={s.hint}>选几个描述现在的你。别人可以按标签给"同类人"送祝福。</p>
        <div className={s.tabs}>
          {[...new Set([...suggested, ...p.tags])].map((tag) => (
            <span
              key={tag}
              className={`${s.tab} ${p.tags.includes(tag) ? s.on : ''}`}
              onClick={() => {
                toggleTag(tag);
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className={s.card}>
        <button className="ghost" onClick={() => nav('/streak')}>
          回响
        </button>{' '}
        <button className="ghost" onClick={() => nav('/compose')}>
          去写祝福
        </button>
      </div>
      {saved && <p className={s.hint}>已保存。</p>}
    </div>
  );
}
