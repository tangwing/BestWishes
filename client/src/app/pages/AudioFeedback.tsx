import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type MyAudioFeedback } from '../../api/client';
import { useSession } from '../session';
import s from '../app.module.css';

const COMPLETENESS_LABEL: Record<string, string> = {
  complete: '完整',
  partial: '部分',
  incomplete: '明显不完整',
};
const SCORE_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' };
const PERSONALIZATION_LABEL: Record<string, string> = {
  high: '很贴合 TA 的处境',
  moderate: '有一点呼应',
  low: '比较通用',
};

export function AudioFeedback() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<MyAudioFeedback | null | undefined>(undefined);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    const tick = () => {
      void api
        .audioFeedback(id)
        .then((f) => {
          if (active) setFeedback(f);
        })
        .catch(() => undefined);
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(h);
    };
  }, [id, user]);

  return (
    <div className={s.page}>
      <h1>已发出这段祝福 ✔</h1>
      <p className={s.lead}>你的录音已经送出去了。这里是它的用心反馈——只有你自己能看到。</p>

      {feedback === undefined && (
        <div className={s.card}>
          <p className={s.lead}>评估中，稍等一下…</p>
        </div>
      )}
      {feedback === null && (
        <div className={s.card}>
          <p className={s.lead}>这条内容没有通过安全审核，不会送达，也没有反馈。</p>
        </div>
      )}
      {feedback && (
        <div className={s.card}>
          <div className={s.tabs}>
            <span className={s.tab}>完整度：{COMPLETENESS_LABEL[feedback.completeness] ?? feedback.completeness}</span>
            <span className={s.tab}>专注度：{SCORE_LABEL[feedback.focus] ?? feedback.focus}</span>
            <span className={s.tab}>真诚度：{SCORE_LABEL[feedback.sincerity] ?? feedback.sincerity}</span>
          </div>
          <p className={s.hint} style={{ marginTop: 10 }}>
            {PERSONALIZATION_LABEL[feedback.personalization] ?? feedback.personalization}
          </p>
          {!feedback.livenessPassed && (
            <p className={s.error} style={{ marginTop: 8 }}>
              没有在录音里听清验证码，这条已经转人工复核，通过后才会送达。
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <a onClick={() => nav('/plaza')}>回到祈福广场</a>
      </div>
    </div>
  );
}
