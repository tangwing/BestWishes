import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type PublicPage as Page } from '../../api/client';
import s from '../app.module.css';

const OCC: Record<string, string> = {
  birthday: '生日',
  festival: '节日',
  encouragement: '鼓励',
  recovery: '康复祈愿',
  remembrance: '纪念 / 追思',
  daily: '日常问候',
};

const CATEGORIES: [string, string][] = [
  ['misinformation', '不实信息'],
  ['offensive', '冒犯内容'],
  ['harassment', '骚扰'],
  ['illegal', '涉嫌违法'],
  ['other', '其他'],
];

export function PublicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (slug)
        void api.publicPage(slug).then((p) => {
          if (active) setPage(p);
        });
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(h);
    };
  }, [slug]);

  if (!page) return <div className={s.placeholder}>…</div>;

  return (
    <div className={s.app}>
      <div className={s.topbar}>
        <span className={s.brand}>BestWishes</span>
        <Link to="/" style={{ fontSize: 13, color: 'var(--soft)' }}>
          我也写一段 →
        </Link>
      </div>

      {page.type !== 'content' && (
        <div className={s.placeholder}>
          <div className="breathe" />
          {'placeholderText' in page ? page.placeholderText : ''}
        </div>
      )}

      {page.type === 'content' && (
        <div className={s.page}>
          <p className={s.hint}>
            给 {page.content.toName} · {OCC[page.content.occasion]}
          </p>
          <div className={s.card} style={{ padding: 26 }}>
            <p className={s.blessing}>{page.content.body}</p>
            <p className={s.meta}>
              {page.content.fromLine}
              <br />
              {new Date(page.content.publishedAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
          <p className={s.hint}>内容由用户创作。</p>
          {!reported && !showReport && (
            <button
              className="link"
              onClick={() => {
                setShowReport(true);
              }}
            >
              举报这份内容
            </button>
          )}
          {showReport && slug && (
            <div className={s.card}>
              <h2>举报</h2>
              {CATEGORIES.map(([cat, label]) => (
                <button
                  key={cat}
                  className="ghost"
                  style={{ margin: 4, fontSize: 12 }}
                  onClick={() => {
                    void api.report(slug, cat, label).then(() => {
                      setReported(true);
                      setShowReport(false);
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {reported && <p className={s.hint}>已收到你的反馈，我们会尽快核实。</p>}
        </div>
      )}
    </div>
  );
}
