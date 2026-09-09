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
  const [situationText, setSituationText] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
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
        situationText,
        scriptText: scriptText.trim() || undefined,
        tags,
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
        写下你此刻的处境或心事，让愿意帮你的人知道该往哪个方向送祝福。可以附一段具体的话让对方念，也可以完全交给对方自由发挥。
      </div>

      <h2>你的处境 / 心事</h2>
      <textarea
        value={situationText}
        onChange={(e) => {
          setSituationText(e.target.value);
        }}
        placeholder="最近遇到了什么，心情怎么样，希望被怎么祝福……"
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

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy || len < 5} onClick={publish}>
          发布
        </button>
      </div>
    </div>
  );
}
