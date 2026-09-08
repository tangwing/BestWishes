// 录音组件：MediaRecorder 录制 + AnalyserNode 实时波形 + 计时。
// 转写：P2 不接真实语音识别（design.md 的取舍——真实云 ASR 是后续接入项），
// 由录音人自己把说的内容补充成文字；这段文字就是打分管线的 clientTranscript
// 输入（见 server 的 AsrHint 信任边界说明）。
//
// 跨浏览器：Safari 与 Chrome 支持的容器格式不同（Safari 只出 audio/mp4，
// Chrome 出 audio/webm），且 Safari 老版本只有 webkitAudioContext。波形依赖
// 的 AudioContext / AnalyserNode 只是装饰，任何一步失败都不能阻断录音本身
// ——否则用户录完看到报错、且外层"发送"按钮因为拿不到录音一直点不动。

import { useEffect, useRef, useState } from 'react';
import s from '../app.module.css';

export type RecorderPhase = 'idle' | 'recording' | 'recorded';

export interface RecordedAudio {
  blob: Blob;
  durationSec: number;
}

/** 选一个当前浏览器真正支持的录音容器格式；拿不准就返回 undefined 让浏览器自己决定。 */
function pickMimeType(): string | undefined {
  // Safari 的 isTypeSupported 既可能整个方法不存在（老版本），也可能对 audio/webm
  // 谎报 true 但构造时抛错——所以这里只用它做"正向探测"，真正的兜底在 makeRecorder。
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  for (const type of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** 先按探测到的格式构造，抛错就退回让浏览器自己挑（Safari 对 audio/webm 会谎报支持）。 */
function makeRecorder(stream: MediaStream): MediaRecorder {
  const preferred = pickMimeType();
  if (preferred) {
    try {
      return new MediaRecorder(stream, { mimeType: preferred });
    } catch {
      /* 落到下面的无参构造 */
    }
  }
  return new MediaRecorder(stream);
}

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof AudioContext !== 'undefined') return AudioContext;
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
  return w.webkitAudioContext;
}

export function AudioRecorder(props: {
  minDurationSec: number;
  maxDurationSec: number;
  onRecorded: (audio: RecordedAudio | null) => void;
}) {
  const { minDurationSec, maxDurationSec, onRecorded } = props;
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [err, setErr] = useState('');
  const [diag, setDiag] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8a9a6b';
    ctx.beginPath();
    const step = canvas.width / data.length;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] ?? 128) / 128 - 1;
      const y = canvas.height / 2 + v * (canvas.height / 2 - 4);
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    rafRef.current = requestAnimationFrame(drawWaveform);
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  /** 波形是装饰：AudioContext 建不起来（老 Safari / 达到上下文数量上限）就跳过，不影响录音。 */
  function tryStartWaveform(stream: MediaStream) {
    try {
      const AudioCtx = getAudioContextCtor();
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      void audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawWaveform();
    } catch {
      analyserRef.current = null;
    }
  }

  async function start() {
    setErr('');
    setDiag('');
    if (!('mediaDevices' in navigator) || typeof MediaRecorder === 'undefined') {
      setErr('这个浏览器不支持录音，换较新的 Safari 或 Chrome 试试');
      setDiag(`不支持：mediaDevices=${String('mediaDevices' in navigator)} MediaRecorder=${typeof MediaRecorder}`);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErr('没能打开麦克风。检查一下权限设置？');
      setDiag(`getUserMedia 失败：${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      recorder = makeRecorder(stream);
    } catch (e) {
      stopTracks();
      setErr('这个浏览器的录音格式不受支持，换 Chrome 试试');
      setDiag(`MediaRecorder 构造失败：${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
      return;
    }

    tryStartWaveform(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = (e: Event) => {
      stopTracks();
      setPhase('idle');
      setElapsedSec(0);
      setErr('录音出错了，重试一下');
      const inner = (e as unknown as { error?: { name?: string; message?: string } }).error;
      setDiag(`recorder.onerror：${inner ? `${inner.name ?? ''} ${inner.message ?? ''}` : e.type}`);
      onRecorded(null);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      stopTracks();
      setDiag(
        `已停止：${String(chunksRef.current.length)} 段 · ${String(Math.round(blob.size / 1024))} KB · ${type || '(空 type)'} · ${String(durationSec)} 秒`,
      );
      if (blob.size === 0) {
        setPhase('idle');
        setElapsedSec(0);
        setErr('没录到声音，检查麦克风后重试');
        onRecorded(null);
        return;
      }
      setPlaybackUrl(URL.createObjectURL(blob));
      setPhase('recorded');
      onRecorded({ blob, durationSec });
    };
    mediaRecorderRef.current = recorder;
    startedAtRef.current = Date.now();
    try {
      // 不传 timeslice：Safari 对 timeslice 支持不稳，最终只在 stop() 时收一整段最兼容。
      recorder.start();
    } catch (e) {
      stopTracks();
      setPhase('idle');
      setErr('没能开始录音，重试一下');
      setDiag(`recorder.start 失败：${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
      onRecorded(null);
      return;
    }
    setDiag(`录制中：state=${recorder.state} · mimeType=${recorder.mimeType || '(默认)'}`);
    setPhase('recording');
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSec) stop();
        return next;
      });
    }, 1000);
  }

  function stop() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }

  function reset() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    setErr('');
    setDiag('');
    setPhase('idle');
    setElapsedSec(0);
    onRecorded(null);
  }

  useEffect(() => () => stopTracks(), []);

  return (
    <div className={s.card}>
      <canvas
        ref={canvasRef}
        width={400}
        height={80}
        style={{ width: '100%', height: 80, background: '#f1efe6', borderRadius: 8 }}
      />
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        {phase === 'idle' && (
          <button type="button" onClick={() => void start()}>
            开始录音
          </button>
        )}
        {phase === 'recording' && (
          <>
            <button type="button" className="ghost" onClick={stop}>
              结束录音
            </button>
            <span className={s.meta}>已录 {elapsedSec} 秒</span>
          </>
        )}
        {phase === 'recorded' && (
          <>
            {playbackUrl && <audio controls src={playbackUrl} style={{ height: 32 }} />}
            <button type="button" className="link" onClick={reset}>
              重录
            </button>
          </>
        )}
      </div>
      {err && <p className={s.error}>{err}</p>}
      {diag && (
        <p className={s.hint} style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>
          诊断：{diag}
        </p>
      )}
      <p className={s.hint} style={{ marginTop: 8 }}>
        录音时长建议 {minDurationSec}–{maxDurationSec} 秒。
      </p>
    </div>
  );
}
