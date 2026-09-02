import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../useStore';
import { OCCASION_LABEL } from '../../store/seed';
import type { Occasion, Personalization } from '../../domain/types';

export function Compose() {
  const store = useStore();
  const nav = useNavigate();
  const user = store.currentUser();
  const templates = store.getTemplates();
  const draft = store.getDraft();
  const profile = store.getProfile();

  const [occasion, setOccasion] = useState<Occasion>(draft?.occasion ?? 'daily');
  const [body, setBody] = useState(draft?.body ?? '');
  const [p, setP] = useState<Personalization>(
    draft?.personalization ?? {
      toName: '',
      fromName: profile.fromName,
      fromCity: profile.city,
    },
  );
  const [err, setErr] = useState('');
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [templatesFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      nav('/');
      return;
    }
    if (!store.hasValidConsent()) nav('/agreement');
  }, [user, store, nav]);

  // 自动存草稿（不触发审核、不生成链接）
  useEffect(() => {
    const t = setTimeout(() => {
      if (body.trim() || p.toName.trim()) store.saveDraft(body, p, occasion);
    }, 800);
    return () => clearTimeout(t);
  }, [body, p, occasion, store]);

  const bodyLen = useMemo(() => [...body.trim()].length, [body]);
  const cfg = store.getConfig();

  const byOccasion = templates.filter((t) => t.occasion === occasion);

  function submit() {
    setErr('');
    try {
      const { id } = store.submitBlessing({ body, personalization: p, occasion });
      nav(`/sent/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="page">
      <h1>写一段祝福</h1>

      <div className="breathe" />
      <p className="hint" style={{ textAlign: 'center' }}>
        不必赶。先想清楚写给谁，深呼吸一次，再开始。
      </p>

      <h2>场景</h2>
      <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion)}>
        {Object.entries(OCCASION_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <h2>范本（只作参考）</h2>
      {templatesFailed ? (
        <p className="hint">范本加载失败，直接自己写吧。</p>
      ) : (
        <div>
          <p className="hint">
            范本只是给你一个起头的方向。正文要你自己敲，一个字一个字写给 TA。
          </p>
          {byOccasion.map((t) => (
            <div className="card" key={t.id} style={{ padding: 12 }}>
              <b style={{ fontSize: 14 }}>{t.title}</b>
              <p className="hint" style={{ margin: '4px 0' }}>
                {t.prompt}
              </p>
              <p
                className="blessing"
                style={{ fontSize: 15, margin: '6px 0', userSelect: 'none' }}
              >
                {t.sample}
              </p>
            </div>
          ))}
        </div>
      )}

      <h2>祝福正文</h2>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          setPasteBlocked(true);
        }}
        placeholder="慢慢写，写给一个具体的人。"
      />
      <div className="count">
        {bodyLen} 字 · 建议 {cfg.bodyMinLen}–{cfg.bodyMaxLen}
      </div>
      {pasteBlocked && (
        <p className="hint" onClick={() => setPasteBlocked(false)}>
          用你自己的话写出来，TA 会感受到不一样。（点这里关掉）
        </p>
      )}

      <h2>让 TA 知道是谁在祝福</h2>
      <label>给谁（必填）</label>
      <input
        type="text"
        value={p.toName}
        placeholder="称呼，如 阿明 / 妈妈"
        onChange={(e) => setP({ ...p, toName: e.target.value })}
      />
      <label>我是谁（落款）</label>
      <input
        type="text"
        value={p.fromName ?? ''}
        onChange={(e) => setP({ ...p, fromName: e.target.value })}
      />
      <label>我的城市</label>
      <input
        type="text"
        value={p.fromCity ?? ''}
        placeholder="只到城市，用于「来自 XX 的祝福」"
        onChange={(e) => setP({ ...p, fromCity: e.target.value })}
      />
      <p className="hint">落款和城市的默认值来自个人空间，这里可以临时改。</p>

      {err && <div className="error">{err}</div>}

      <div style={{ marginTop: 20 }}>
        <button onClick={submit}>写好了，发送</button>{' '}
        <span className="hint">草稿已自动保存</span>
      </div>
    </div>
  );
}
