// 录音组件：MediaRecorder 录制 + AnalyserNode 实时波形 + 计时。
// 转写：P2 不接真实语音识别（design.md 的取舍——真实云 ASR 是后续接入项），
// 由录音人自己把说的内容补充成文字；这段文字就是打分管线的 clientTranscript
// 输入（见 server 的 AsrHint 信任边界说明）。

import { useEffect, useRef, useState } from 'react';
import s from '../app.module.css';

export type RecorderPhase = 'idle' | 'recording' | 'recorded';

export interface RecordedAudio {
  blob: Blob;
  durationSec: number;
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
  }

  async function start() {
    setErr('');
    if (!('mediaDevices' in navigator)) {
      setErr('这个浏览器不支持录音');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
        setPlaybackUrl(URL.createObjectURL(blob));
        setPhase('recorded');
        stopTracks();
        onRecorded({ blob, durationSec });
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setPhase('recording');
      setElapsedSec(0);
      drawWaveform();
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          if (next >= maxDurationSec) stop();
          return next;
        });
      }, 1000);
    } catch {
      setErr('没能打开麦克风。检查一下权限设置？');
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
  }

  function reset() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
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
      <p className={s.hint} style={{ marginTop: 8 }}>
        录音时长建议 {minDurationSec}–{maxDurationSec} 秒。
      </p>
    </div>
  );
}
