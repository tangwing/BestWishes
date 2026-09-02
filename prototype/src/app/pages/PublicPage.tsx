import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../useStore';
import { OCCASION_LABEL } from '../../store/seed';
import type { ReportCategory } from '../../domain/types';

// 访客落地页。无登录墙。按祝福状态渲染正文或中性占位。
export function PublicPage() {
  const store = useStore();
  const { slug } = useParams();
  const page = slug ? store.getPublicPage(slug) : { type: 'not_found' as const };
  const [reported, setReported] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const fingerprint = useFingerprint();

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          BestWishes <small>一份祝福</small>
        </span>
        <Link to="/" className="nav">
          <span style={{ fontSize: 13 }}>我也写一段 →</span>
        </Link>
      </div>

      {page.type !== 'content' && (
        <div className="placeholder">
          <div className="breathe" />
          {page.placeholderText}
        </div>
      )}

      {page.type === 'content' && page.content && (
        <div className="page">
          <p className="hint">给 {page.content.toName} · {OCCASION_LABEL[page.content.occasion]}</p>
          <div className="card" style={{ padding: 26 }}>
            <p className="blessing">{page.content.body}</p>
            <p className="meta">
              {page.content.fromLine}
              <br />
              {new Date(page.content.publishedAt).toLocaleDateString('zh-CN')}
            </p>
          </div>

          <p className="hint">内容由用户创作。</p>

          {!reported && !showReport && (
            <button className="link" onClick={() => setShowReport(true)}>
              举报这份内容
            </button>
          )}
          {showReport && slug && (
            <div className="card">
              <h2>举报</h2>
              {(
                [
                  ['misinformation', '不实信息'],
                  ['offensive', '冒犯内容'],
                  ['harassment', '骚扰'],
                  ['illegal', '涉嫌违法'],
                  ['other', '其他'],
                ] as [ReportCategory, string][]
              ).map(([cat, label]) => (
                <button
                  key={String(cat)}
                  className="ghost"
                  style={{ margin: 4, fontSize: 12 }}
                  onClick={() => {
                    store.report(slug, cat, label, fingerprint);
                    setReported(true);
                    setShowReport(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {reported && <p className="hint">已收到你的反馈，我们会尽快核实。</p>}
        </div>
      )}
    </div>
  );
}

function useFingerprint(): string {
  const key = 'bw_visitor_fp';
  try {
    let v = localStorage.getItem(key);
    if (!v) {
      v = 'fp_' + Math.random().toString(36).slice(2);
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return 'fp_anon';
  }
}
