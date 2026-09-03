import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Occasion } from '@bestwishes/shared';
import {
  api,
  ApiCallError,
  type AudienceFilter,
  type AudienceGender,
  type AudiencePreview,
  type Template,
} from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const OCCASIONS: [Occasion, string][] = [
  ['daily', '日常问候'],
  ['encouragement', '鼓励'],
  ['birthday', '生日'],
  ['festival', '节日'],
  ['recovery', '康复祈愿'],
  ['remembrance', '纪念 / 追思'],
];

const CONTENT_TYPES: [string, string, boolean][] = [
  ['text', '文字', true],
  ['audio', '语音', false],
  ['video', '视频', false],
];

const GENDER_OPTIONS: [AudienceGender, string][] = [
  ['any', '不限'],
  ['male', '男'],
  ['female', '女'],
  ['other', '其他'],
];

const DEFAULT_FILTER: AudienceFilter = {
  radiusKm: 5,
  ageMin: null,
  ageMax: null,
  gender: 'any',
  tags: [],
};

export function Compose() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const replyToUserId = params.get('replyTo');
  const replyToName = params.get('to') ?? '这位朋友';
  const isReply = Boolean(replyToUserId);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<Occasion>('daily');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>(DEFAULT_FILTER);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [canBroadcast, setCanBroadcast] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    void api
      .templates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
    void api.suggestedTags().then((r) => {
      setSuggestedTags(r.tags);
    });
    void api.profile().then((prof) => {
      setCanBroadcast(prof.canBroadcast);
    });
    void api.agreement().then((a) => {
      if (!a.alreadyConsented) nav('/agreement');
    });
  }, [user, nav]);

  const bodyLen = useMemo(() => Array.from(body.trim()).length, [body]);
  const byOccasion = templates.filter((t) => t.category === occasion);

  // 改动筛选条件后，之前的预览作废
  useEffect(() => {
    setPreview(null);
  }, [filter]);

  function runPreview() {
    setErr('');
    setPreviewBusy(true);
    void api
      .audiencePreview(filter)
      .then(setPreview)
      .catch((e: unknown) => {
        setErr(e instanceof ApiCallError ? e.message : '预览失败');
      })
      .finally(() => {
        setPreviewBusy(false);
      });
  }

  function submit() {
    setErr('');
    setBusy(true);
    void api
      .submit(
        isReply && replyToUserId
          ? { contentType: 'text', body, occasion, scope: 'reply', replyToUserId }
          : { contentType: 'text', body, occasion, scope: 'broadcast', audience: filter },
      )
      .then((r) => {
        nav(`/sent/${r.id}`);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiCallError && e.code === 'consent_required') {
          nav('/agreement');
          return;
        }
        setErr(e instanceof ApiCallError ? e.message : '出错了');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const canSubmit =
    bodyLen >= 15 && (isReply || (preview !== null && preview.canSend));

  return (
    <div className={s.page}>
      <h1>{isReply ? `回一段祝福给 ${replyToName}` : '给陌生人写一段祝福'}</h1>
      <div className="breathe" />
      <div className={s.intention}>
        {isReply
          ? '不必客套。就着 TA 的祝福，说一句你此刻真实想说的话。'
          : '你不认识 TA，TA 也不认识你。想一想此刻某个可能正需要一句好话的人，写给 TA。'}
      </div>

      <h2>形式</h2>
      <div className={s.tabs}>
        {CONTENT_TYPES.map(([k, label, enabled]) => (
          <span
            key={k}
            className={`${s.tab} ${k === 'text' ? s.on : ''} ${enabled ? '' : s.disabled}`}
            title={enabled ? '' : '即将支持'}
          >
            {label}
            {!enabled && ' · 即将支持'}
          </span>
        ))}
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

      {!isReply && (
        <>
          <h2>送给谁</h2>
          {!canBroadcast && (
            <p className={s.error}>
              先去<a onClick={() => nav('/profile')}> 个人空间 </a>设置你的位置，才能群发。
            </p>
          )}
          <div className={s.card}>
            <label>距离范围：{filter.radiusKm} 公里内</label>
            <input
              type="range"
              min={0.5}
              max={50}
              step={0.5}
              value={filter.radiusKm}
              onChange={(e) => {
                setFilter({ ...filter, radiusKm: Number(e.target.value) });
              }}
            />

            <div className={s.row} style={{ marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label>年龄下限</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  placeholder="不限"
                  value={filter.ageMin ?? ''}
                  onChange={(e) => {
                    setFilter({
                      ...filter,
                      ageMin: e.target.value === '' ? null : Number(e.target.value),
                    });
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>年龄上限</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  placeholder="不限"
                  value={filter.ageMax ?? ''}
                  onChange={(e) => {
                    setFilter({
                      ...filter,
                      ageMax: e.target.value === '' ? null : Number(e.target.value),
                    });
                  }}
                />
              </div>
            </div>

            <label style={{ marginTop: 12 }}>性别</label>
            <div className={s.tabs}>
              {GENDER_OPTIONS.map(([g, label]) => (
                <span
                  key={g}
                  className={`${s.tab} ${filter.gender === g ? s.on : ''}`}
                  onClick={() => {
                    setFilter({ ...filter, gender: g });
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            <label style={{ marginTop: 12 }}>标签（命中任一即可，可不选）</label>
            <div className={s.tabs}>
              {[...new Set([...suggestedTags, ...filter.tags])].map((tag) => (
                <span
                  key={tag}
                  className={`${s.tab} ${filter.tags.includes(tag) ? s.on : ''}`}
                  onClick={() => {
                    setFilter({
                      ...filter,
                      tags: filter.tags.includes(tag)
                        ? filter.tags.filter((x) => x !== tag)
                        : [...filter.tags, tag],
                    });
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="ghost" disabled={previewBusy || !canBroadcast} onClick={runPreview}>
                {previewBusy ? '查询中…' : '预览收件人'}
              </button>
            </div>

            {preview && (
              <div style={{ marginTop: 12 }}>
                {preview.count === 0 && (
                  <p className={s.error}>这个范围里还没有人。放宽条件或扩大距离。</p>
                )}
                {preview.count > preview.cap && (
                  <p className={s.error}>
                    命中 {preview.count} 人，超过一次群发上限 {preview.cap} 人。缩小范围。
                  </p>
                )}
                {preview.canSend && (
                  <p className={s.lead}>
                    将送达 <b>{preview.count}</b> 人（上限 {preview.cap}）。
                  </p>
                )}
                {preview.sample.length > 0 && (
                  <div className={s.card} style={{ background: 'transparent' }}>
                    {preview.sample.map((row, i) => (
                      <div key={i} className={s.meta}>
                        {row.nickname}
                        {row.city ? ` · ${row.city}` : ''} · {row.distanceKm} km
                        {row.age !== null ? ` · ${row.age}岁` : ''}
                      </div>
                    ))}
                    {preview.count > preview.sample.length && (
                      <div className={s.meta}>…等 {preview.count} 人</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {isReply && (
        <p className={s.hint}>这段祝福只会送到 {replyToName} 的收件箱，同样会先过一遍内容校验。</p>
      )}

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy || !canSubmit} onClick={submit}>
          {isReply ? '回过去' : '发送'}
        </button>
      </div>
    </div>
  );
}
