// 祈福详情（/plaza/:id）：处境全文 + 稿子 + 聚合统计 + 全部 published 回应。
// 回应内容只在这里能看到（广场列表只给统计）。不展示回应者的评分细节。

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  api,
  ApiCallError,
  type ResponseView,
  type WishRequestDetail as Detail,
} from '../../api/client';
import { useSession } from '../session';
import { formatTimestamp } from '../formatTime';
import s from '../app.module.css';

export function WishRequestDetail() {
  const { user } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [replyErr, setReplyErr] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!id) return;
    api
      .wishRequestDetail(id)
      .then(setR)
      .catch(() => {
        setNotFound(true);
      });
  }, [id]);

  useEffect(() => {
    load();
    // 回应经过打分 + hold 才会 published，轮询等它出现（同 Inbox 的做法）
    const h = setInterval(load, 3000);
    return () => {
      clearInterval(h);
    };
  }, [load]);

  useEffect(() => {
    // 只在页面打开时记一次浏览，不能挂在上面的轮询里——那样每 3 秒就会自己把自己的
    // 浏览量刷上去，数字就没意义了。
    if (id) void api.recordWishRequestView(id);
  }, [id]);

  /** 一条回应下面往返回复的"该回给谁"：固定是这条回应涉及的两个人之一——
   * 我是请求人就回给回应者，我是回应者（或后面接话的那个人）就回给请求人。 */
  function otherParty(resp: ResponseView): string | null {
    if (!user || !r) return null;
    if (user.id === r.authorId) return resp.fromUserId;
    if (user.id === resp.fromUserId) return r.authorId;
    return null; // 不是这条回应的当事人，不能回复
  }

  function sendReply(resp: ResponseView) {
    const target = otherParty(resp);
    const body = (drafts[resp.id] ?? '').trim();
    if (!target || !body || !id) return;
    const lastMessageId = resp.replies[resp.replies.length - 1]?.id ?? resp.id;
    setReplyBusy(resp.id);
    setReplyErr((e) => ({ ...e, [resp.id]: '' }));
    void api
      .submit({
        contentType: 'text',
        body,
        occasion: 'daily',
        scope: 'reply',
        replyToUserId: target,
        replyToBlessingId: lastMessageId,
      })
      .then(() => {
        setDrafts((d) => ({ ...d, [resp.id]: '' }));
        load();
      })
      .catch((e: unknown) => {
        if (e instanceof ApiCallError && e.code === 'consent_required') {
          nav(`/agreement?returnTo=${encodeURIComponent(`/plaza/${id}`)}`);
          return;
        }
        setReplyErr((prev) => ({
          ...prev,
          [resp.id]: e instanceof ApiCallError ? e.message : '回复失败',
        }));
      })
      .finally(() => {
        setReplyBusy(null);
      });
  }

  if (notFound) return <div className={s.page}>找不到这条祈福。</div>;
  if (!r) return <div className={s.page}>…</div>;

  return (
    <div className={s.page}>
      <h1>祈福</h1>
      <div className={s.card}>
        <p className={s.hint}>
          来自 {r.authorNickname}
          {r.authorCity ? ` · ${r.authorCity}` : ''} · {formatTimestamp(r.createdAt)}
          {r.isMine && r.viewCount !== null && ` · 被浏览 ${String(r.viewCount)} 次`}
        </p>
        <p className={s.blessing} style={{ fontWeight: 600 }}>
          为 {r.beneficiaryLabel} 祈福
        </p>
        <p className={s.blessing}>{r.situationText}</p>
        {r.scriptText && (
          <>
            <p className={s.hint} style={{ marginTop: 10 }}>
              TA 希望被这样念
            </p>
            <p className={s.blessing} style={{ fontStyle: 'italic' }}>
              {r.scriptText}
            </p>
          </>
        )}
        {r.tags.length > 0 && (
          <div className={s.tabs} style={{ marginTop: 8 }}>
            {r.tags.map((t) => (
              <span key={t} className={s.tab}>
                {t}
              </span>
            ))}
          </div>
        )}
        {r.state !== 'published' && (
          <p className={s.error} style={{ marginTop: 8 }}>
            {r.state === 'pending_review' ? '这条祈福还在人工复核中，暂未公开。' : '这条祈福已经不再公开了。'}
          </p>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        {!r.isMine && r.state === 'published' && (
          <button
            onClick={() => {
              if (!user) {
                nav('/login');
                return;
              }
              nav(`/plaza/${r.id}/respond`);
            }}
          >
            录一段祝福回应
          </button>
        )}
        {r.isMine && r.state === 'published' && (
          <button
            className="link"
            onClick={() => {
              if (confirm('撤回后这条祈福从广场消失，且不能重新发布。确定撤回？')) {
                void api.withdrawWishRequest(r.id).then(load);
              }
            }}
          >
            撤回这条祈福
          </button>
        )}
      </div>

      <h2 style={{ marginTop: 28 }}>收到的回应（{r.responseCount}）</h2>
      {r.responses.length === 0 && <p className={s.lead}>还没有人回应，再等等。</p>}
      {r.responses.map((resp) => (
        <div className={s.card} key={resp.id}>
          <p className={s.hint}>
            来自 {resp.fromNickname}
            {resp.fromCity ? ` · ${resp.fromCity}` : ''} · {formatTimestamp(resp.createdAt)}
          </p>
          {resp.audioUrl && (
            <audio controls src={resp.audioUrl} style={{ width: '100%', marginTop: 8 }} />
          )}
          {resp.audioLocked && (
            <p className={s.hint} style={{ marginTop: 8 }}>
              <a onClick={() => nav('/login')}>登录后可收听</a>
            </p>
          )}
          {resp.transcript && (
            <p className={s.meta} style={{ marginTop: 6 }}>
              “{resp.transcript}”
            </p>
          )}

          {resp.replies.length > 0 && (
            <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: `2px solid var(--line)` }}>
              {resp.replies.map((rep) => (
                <p className={s.meta} key={rep.id} style={{ marginTop: 8 }}>
                  <b style={{ color: 'var(--accent-ink)' }}>{rep.fromNickname}</b>
                  {' · '}
                  {formatTimestamp(rep.createdAt)}
                  <br />
                  {rep.body}
                </p>
              ))}
            </div>
          )}

          {otherParty(resp) && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={drafts[resp.id] ?? ''}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [resp.id]: e.target.value }));
                }}
                placeholder="回一句…"
                style={{ minHeight: 50, fontSize: 14 }}
              />
              {replyErr[resp.id] && <p className={s.error}>{replyErr[resp.id]}</p>}
              <button
                className="ghost"
                disabled={replyBusy === resp.id || !(drafts[resp.id] ?? '').trim()}
                onClick={() => {
                  sendReply(resp);
                }}
              >
                回复
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
