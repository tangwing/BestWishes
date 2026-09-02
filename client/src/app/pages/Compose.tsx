import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Occasion } from '@bestwishes/shared';
import { api, ApiCallError, type Personalization, type Template } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const OCCASIONS: [Occasion, string][] = [
  ['birthday', '生日'],
  ['festival', '节日'],
  ['encouragement', '鼓励'],
  ['recovery', '康复祈愿'],
  ['remembrance', '纪念 / 追思'],
  ['daily', '日常问候'],
];

export function Compose() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [occasion, setOccasion] = useState<Occasion>('daily');
  const [body, setBody] = useState('');
  const [p, setP] = useState<Personalization>({ toName: '' });
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    void api
      .templates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
    void api.profile().then((prof) => {
      setP((cur) => ({ ...cur, fromName: prof.senderName, fromCity: prof.regionCity }));
    });
    void api.agreement().catch((e: unknown) => {
      if (e instanceof ApiCallError && e.code === 'consent_required') nav('/agreement');
    });
  }, [user, nav]);

  const bodyLen = useMemo(() => Array.from(body.trim()).length, [body]);
  const byOccasion = templates.filter((t) => t.category === occasion);

  function submit() {
    setErr('');
    setBusy(true);
    void api
      .submit({ body, occasion, personalization: p })
      .then((r) => {
        nav(`/sent/${r.id}`);
      })
      .catch((e: unknown) => {
        setErr(e instanceof ApiCallError ? e.message : '出错了');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className={s.page}>
      <h1>写一段祝福</h1>
      <div className="breathe" />
      <div className={s.intention}>
        先别急着写。想一想 TA
        打开这段话的时候，正处在什么样的心情——然后用你自己的话，一个字一个字写给 TA。
      </div>

      <h2>场景</h2>
      <div className={s.tabs}>
        {OCCASIONS.map(([k, v]) => (
          <span
            key={k}
            className={`${s.tab} ${k === occasion ? s.on : ''}`}
            onClick={() => {
              setOccasion(k);
            }}
          >
            {v}
          </span>
        ))}
      </div>

      <h2>范本（只作参考，不能一键套用）</h2>
      {byOccasion.map((t) => (
        <div className={s.card} key={t.id} style={{ padding: 12 }}>
          <b style={{ fontSize: 14 }}>{t.title}</b>
          <p className={s.hint} style={{ margin: '2px 0 4px' }}>
            {t.promptText}
          </p>
          <p className={s.blessing} style={{ fontSize: 14, userSelect: 'none' }}>
            {t.sampleText}
          </p>
        </div>
      ))}

      <h2>祝福正文（自己写）</h2>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        onPaste={(e) => {
          e.preventDefault();
          setPasteBlocked(true);
        }}
        placeholder="慢慢写，写给一个具体的人。"
        style={{ minHeight: 150, fontFamily: 'var(--serif)', fontSize: 16 }}
      />
      <div className={s.count}>{bodyLen} 字 · 建议 15–500</div>
      {pasteBlocked && (
        <p
          className={s.error}
          onClick={() => {
            setPasteBlocked(false);
          }}
        >
          用你自己的话写出来，TA 会感受到不一样。（点这里关掉）
        </p>
      )}

      <h2>让 TA 知道是谁在祝福</h2>
      <label>给谁（必填）</label>
      <input
        type="text"
        value={p.toName}
        placeholder="称呼，如 阿明 / 妈妈"
        onChange={(e) => {
          setP({ ...p, toName: e.target.value });
        }}
      />
      <label>我是谁（落款）</label>
      <input
        type="text"
        value={p.fromName ?? ''}
        onChange={(e) => {
          setP({ ...p, fromName: e.target.value });
        }}
      />
      <label>我的城市</label>
      <input
        type="text"
        value={p.fromCity ?? ''}
        onChange={(e) => {
          setP({ ...p, fromCity: e.target.value });
        }}
      />
      <p className={s.hint}>落款和城市的默认值来自个人空间，这里可以临时改。</p>

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy} onClick={submit}>
          写好了，发送
        </button>
      </div>
    </div>
  );
}
