import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiCallError, type AudioChallenge, type WishRequestView } from '../../api/client';
import { useSession } from '../session';
import { AudioRecorder, type RecordedAudio } from '../components/AudioRecorder';
import s from '../app.module.css';

const MIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 180;

export function RespondToWishRequest() {
  const { user, loading } = useSession();
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<WishRequestView | null>(null);
  const [challenge, setChallenge] = useState<AudioChallenge | null>(null);
  const [recorded, setRecorded] = useState<RecordedAudio | null>(null);
  const [transcript, setTranscript] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  const agreementUrl = id
    ? `/agreement?returnTo=${encodeURIComponent(`/wish-requests/${id}/respond`)}`
    : '/agreement';

  useEffect(() => {
    if (!id || !user) return;
    api.getWishRequest(id).then(setRequest).catch(() => undefined);
    api.issueAudioChallenge().then(setChallenge).catch(() => undefined);
    void api.agreement().then((a) => {
      if (!a.alreadyConsented) nav(agreementUrl);
    });
  }, [id, user, nav, agreementUrl]);

  function submit() {
    if (!id || !recorded || !challenge) return;
    setErr('');
    setBusy(true);
    void api
      .respondToWishRequest(id, {
        audio: recorded.blob,
        durationSec: recorded.durationSec,
        occasion: 'daily',
        challengeToken: challenge.token,
        clientTranscript: transcript.trim() || undefined,
      })
      .then((r) => {
        nav(`/blessings/${r.id}/feedback`);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiCallError && e.code === 'consent_required') {
          nav(agreementUrl);
          return;
        }
        setErr(e instanceof ApiCallError ? e.message : '提交失败');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  if (!request) return <div className={s.page}>…</div>;

  const durationOk =
    recorded !== null &&
    recorded.durationSec >= MIN_DURATION_SEC &&
    recorded.durationSec <= MAX_DURATION_SEC;

  return (
    <div className={s.page}>
      <h1>回一段祝福给 {request.authorNickname}</h1>
      <div className={s.card}>
        <p className={s.hint}>TA 的处境</p>
        <p className={s.blessing}>{request.situationText}</p>
        {request.scriptText && (
          <>
            <p className={s.hint} style={{ marginTop: 10 }}>
              TA 希望被这样念
            </p>
            <p className={s.blessing} style={{ fontStyle: 'italic' }}>
              {request.scriptText}
            </p>
          </>
        )}
      </div>

      {challenge && (
        <div className={s.intention}>
          录音时请说出这个验证码，证明是你本人在录：<b style={{ fontSize: 18 }}>{challenge.phrase}</b>
        </div>
      )}

      <h2>录音</h2>
      <AudioRecorder
        minDurationSec={MIN_DURATION_SEC}
        maxDurationSec={MAX_DURATION_SEC}
        onRecorded={setRecorded}
      />

      <h2>补充文字（帮助我们确认你说了什么，包含验证码）</h2>
      <textarea
        value={transcript}
        onChange={(e) => {
          setTranscript(e.target.value);
        }}
        placeholder={`把刚才说的话大致写一下，记得带上验证码${challenge ? `「${challenge.phrase}」` : ''}`}
        style={{ minHeight: 80, fontFamily: 'var(--serif)', fontSize: 15 }}
      />

      {err && <div className={s.error}>{err}</div>}
      <div style={{ marginTop: 20 }}>
        <button disabled={busy || !durationOk || !transcript.trim() || !challenge} onClick={submit}>
          发出这段祝福
        </button>
        {!busy && (!durationOk || !transcript.trim() || !challenge) && (
          <p className={s.hint} style={{ marginTop: 8 }}>
            还差：
            {!recorded && '录一段音频；'}
            {recorded && !durationOk && `录音时长要在 ${MIN_DURATION_SEC}–${MAX_DURATION_SEC} 秒之间（当前 ${recorded.durationSec} 秒）；`}
            {!transcript.trim() && '补充文字；'}
            {!challenge && '验证码加载中；'}
          </p>
        )}
      </div>
    </div>
  );
}
