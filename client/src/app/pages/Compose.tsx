import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_AUDIENCE_FILTER, type Occasion } from '@bestwishes/shared';
import {
  api,
  ApiCallError,
  type AudienceFilter,
  type AudienceGender,
  type AudiencePreview,
  type Template,
} from '../../api/client';
import { useSession } from '../session';
import { OutboxSection } from '../components/OutboxSection';
import { RangeSlider } from '../components/RangeSlider';
import { agreementUrl, loginUrl } from '../returnTo';
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

const MAX_FILTER_TAGS = 10;
const MAX_TAG_LEN = 20;
const AGE_SLIDER_MIN = 0;
const AGE_SLIDER_MAX = 100;

/** 未登录用户写完内容点提交时的暂存 key——按页面固定一个槽位就够，不需要按会话再拆分
 * （见 design D1：sessionStorage 暂存 + 复用 ?returnTo= 回跳，不做后端草稿）。 */
const DRAFT_KEY = 'bw-draft-compose';

interface ComposeDraft {
  body: string;
  occasion: Occasion;
  filter: AudienceFilter;
}

function saveDraft(draft: ComposeDraft): boolean {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function takeDraft(): ComposeDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) as ComposeDraft;
  } catch {
    return null;
  }
}

interface ComposeNavState {
  copyBody?: string;
  copyOccasion?: Occasion;
}

export function Compose() {
  const { user } = useSession();
  const nav = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const replyToUserId = params.get('replyTo');
  const replyToBlessingId = params.get('replyBlessing') ?? undefined;
  const replyToName = params.get('to') ?? '这位朋友';
  const isReply = Boolean(replyToUserId);
  const copyState = !isReply ? (location.state as ComposeNavState | null) : null;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<Occasion>(copyState?.copyOccasion ?? 'daily');
  const [body, setBody] = useState(copyState?.copyBody ?? '');
  const [filter, setFilter] = useState<AudienceFilter>(DEFAULT_AUDIENCE_FILTER);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [canBroadcast, setCanBroadcast] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  // 未登录 / 未同意协议时提交被打断（跳登录或协议页）后回到这里——按同一个 key 取回刚才写的内容。
  // 访客第一次打开这个页面时 sessionStorage 里没有暂存，取回是 no-op，不影响正常渲染。
  useEffect(() => {
    const draft = takeDraft();
    if (!draft) return;
    setBody(draft.body);
    setOccasion(draft.occasion);
    setFilter(draft.filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [user]);

  const bodyLen = useMemo(() => Array.from(body.trim()).length, [body]);
  const byOccasion = templates.filter((t) => t.category === occasion);

  // 改动筛选条件后，之前的预览作废
  useEffect(() => {
    setPreview(null);
  }, [filter]);

  // "复制以供编辑" 从「我的善意」跳过来时（同一个 /give 路由，组件不重挂），
  // location.key 每次导航都变，据此把要复制的正文 / 场景灌进来。
  useEffect(() => {
    if (isReply) return;
    const st = location.state as ComposeNavState | null;
    if (st?.copyBody !== undefined) setBody(st.copyBody);
    if (st?.copyOccasion !== undefined) setOccasion(st.copyOccasion);
  }, [location.key, location.state, isReply]);

  function addCustomTag() {
    const tag = customTag.trim().slice(0, MAX_TAG_LEN);
    if (!tag || filter.tags.includes(tag) || filter.tags.length >= MAX_FILTER_TAGS) return;
    setFilter({ ...filter, tags: [...filter.tags, tag] });
    setCustomTag('');
  }

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

  const currentPath = `${location.pathname}${location.search}`;

  /** 跳登录 / 协议页之前，把刚写的内容存起来；存不上也不阻断跳转，只是带一个标记，
   * 让登录页提示"登录后可能需要重新输入"（design D1）。 */
  function pauseAndGo(makeUrl: (returnTo: string) => string) {
    const saved = saveDraft({ body, occasion, filter });
    const url = makeUrl(currentPath);
    nav(saved ? url : `${url}&draftLost=1`);
  }

  function submit() {
    if (!user) {
      pauseAndGo(loginUrl);
      return;
    }
    setErr('');
    setBusy(true);
    void api
      .submit(
        isReply && replyToUserId
          ? {
              contentType: 'text',
              body,
              occasion,
              scope: 'reply',
              replyToUserId,
              ...(replyToBlessingId ? { replyToBlessingId } : {}),
            }
          : { contentType: 'text', body, occasion, scope: 'broadcast', audience: filter },
      )
      .then((r) => {
        nav(`/sent/${r.id}`);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiCallError && e.code === 'consent_required') {
          pauseAndGo(agreementUrl);
          return;
        }
        setErr(e instanceof ApiCallError ? e.message : '出错了');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const canSubmit = bodyLen >= 5;

  return (
    <div className={s.page}>
      <h1>{isReply ? `回一段祝福给 ${replyToName}` : '传递善意'}</h1>
      <div className="breathe" />
      <div className={s.intention}>
        {isReply
          ? '不必客套。就着 TA 的祝福，说一句你此刻真实想说的话。'
          : '你不认识 TA，TA 也不认识你。想一想此刻某个可能正需要一句好话的人，写给 TA。'}
      </div>

      {!isReply && (
        <>
          <h2>送给谁</h2>
          {!canBroadcast && (
            <p className={s.error}>
              先去<a onClick={() => nav('/profile')}> 个人空间 </a>设置你的位置，才能群发。
            </p>
          )}
          <div className={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={s.hint}>默认送到 {filter.radiusKm} 公里内，不碰这里也能直接发</span>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setFiltersExpanded(!filtersExpanded);
                }}
              >
                {filtersExpanded ? '收起' : '调整范围'}
              </button>
            </div>

            {filtersExpanded && (
              <>
            <label style={{ marginTop: 10 }}>距离范围：{filter.radiusKm} 公里内</label>
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

            <label style={{ marginTop: 10 }}>年龄范围</label>
            <RangeSlider
              min={AGE_SLIDER_MIN}
              max={AGE_SLIDER_MAX}
              valueMin={filter.ageMin}
              valueMax={filter.ageMax}
              formatValue={(v) => `${String(v)}岁`}
              onChange={(ageMin, ageMax) => {
                setFilter({ ...filter, ageMin, ageMax });
              }}
            />

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
            <div className={s.row}>
              <input
                type="text"
                placeholder="自定义标签，回车添加"
                value={customTag}
                maxLength={MAX_TAG_LEN}
                disabled={filter.tags.length >= MAX_FILTER_TAGS}
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
              <button
                type="button"
                onClick={addCustomTag}
                disabled={!customTag.trim() || filter.tags.length >= MAX_FILTER_TAGS}
              >
                添加
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                className="ghost"
                disabled={previewBusy || !canBroadcast}
                onClick={runPreview}
              >
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
              </>
            )}
          </div>
        </>
      )}

      {isReply && (
        <p className={s.hint}>这段祝福只会送到 {replyToName} 的福袋，同样会先过一遍内容校验。</p>
      )}

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
      <div className={s.count}>{bodyLen} 字 · 建议 5–500</div>
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

      {byOccasion.length > 0 &&
        (showTemplates ? (
          <>
            <div className={s.row} style={{ alignItems: 'baseline' }}>
              <h2 style={{ flex: 1 }}>范本（只作参考，不能一键套用）</h2>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setShowTemplates(false);
                }}
              >
                收起
              </button>
            </div>
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
          </>
        ) : (
          <button
            type="button"
            className="link"
            onClick={() => {
              setShowTemplates(true);
            }}
          >
            不知道怎么写？看几个范本
          </button>
        ))}

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy || !canSubmit} onClick={submit}>
          {isReply ? '回过去' : '发送'}
        </button>
      </div>

      {!isReply && <OutboxSection />}
    </div>
  );
}
