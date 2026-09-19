import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiCallError } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;

export function PublishWishRequest() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const [beneficiaryLabel, setBeneficiaryLabel] = useState('');
  const [situationText, setSituationText] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    void api.suggestedTags().then((r) => {
      setSuggestedTags(r.tags);
    });
    void api.agreement().then((a) => {
      if (!a.alreadyConsented) nav('/agreement?returnTo=%2Fplaza%2Fnew');
    });
  }, [user, nav]);

  const len = useMemo(() => Array.from(situationText.trim()).length, [situationText]);

  function addCustomTag() {
    const tag = customTag.trim().slice(0, MAX_TAG_LEN);
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    setTags([...tags, tag]);
    setCustomTag('');
  }

  function publish() {
    setErr('');
    setBusy(true);
    void api
      .publishWishRequest({
        beneficiaryLabel: beneficiaryLabel.trim(),
        situationText,
        scriptText: scriptText.trim() || undefined,
        tags,
        anonymous,
      })
      .then((r) => {
        nav(`/plaza/${r.id}`);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiCallError && e.code === 'consent_required') {
          nav('/agreement?returnTo=%2Fplaza%2Fnew');
          return;
        }
        setErr(e instanceof ApiCallError ? e.message : '出错了');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className={s.page}>
      <h1>发一条祈福</h1>
      <div className={s.intention}>
        祈福广场是为你牵挂的人而开的地方——把TA放在心上，写下你想为TA送出的祝福，而不是为自己求安慰。
      </div>

      <h2>TA是谁</h2>
      <p className={s.hint}>一句话说清这条祈福是为谁写的，比如"我生病的奶奶"「刚经历分手的朋友」「一位素不相识但需要鼓励的人」。</p>
      <input
        type="text"
        value={beneficiaryLabel}
        onChange={(e) => {
          setBeneficiaryLabel(e.target.value.slice(0, 40));
        }}
        placeholder="TA是……"
        maxLength={40}
        style={{ fontFamily: 'var(--serif)', fontSize: 16 }}
      />

      <h2>TA的处境，你想对TA说的话</h2>
      <textarea
        value={situationText}
        onChange={(e) => {
          setSituationText(e.target.value);
        }}
        placeholder="TA最近经历了什么，你希望TA被怎样祝福……"
        style={{ minHeight: 120, fontFamily: 'var(--serif)', fontSize: 16 }}
      />
      <div className={s.count}>{len} 字 · 建议 5–500</div>

      <h2>稿子（可选）</h2>
      <p className={s.hint}>如果希望对方念一段具体的话，写在这里；留空则对方自由发挥。</p>
      <textarea
        value={scriptText}
        onChange={(e) => {
          setScriptText(e.target.value);
        }}
        placeholder="例如：愿你放下焦虑，一步一步来……"
        style={{ minHeight: 80, fontFamily: 'var(--serif)', fontSize: 15 }}
      />

      <h2>标签（可选，帮我们把请求推给可能感兴趣的人）</h2>
      <div className={s.tabs}>
        {[...new Set([...suggestedTags, ...tags])].map((tag) => (
          <span
            key={tag}
            className={`${s.tab} ${tags.includes(tag) ? s.on : ''}`}
            onClick={() => {
              setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]);
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div className={s.row}>
        <input
          type="text"
          placeholder="自定义标签，回车添加"
          value={customTag}
          maxLength={MAX_TAG_LEN}
          disabled={tags.length >= MAX_TAGS}
          onChange={(e) => {
            setCustomTag(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomTag();
            }
          }}
        />
        <button type="button" onClick={addCustomTag} disabled={!customTag.trim() || tags.length >= MAX_TAGS}>
          添加
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => {
              setAnonymous(e.target.checked);
            }}
          />
          匿名发布
        </label>
        <p className={s.hint} style={{ marginTop: 4 }}>
          匿名只对外——广场和详情会显示"一位朋友"，不影响你收到回应，发布后不能再更改。
        </p>
      </div>

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy || len < 5} onClick={publish}>
          发布
        </button>
      </div>
    </div>
  );
}
