import { useState } from 'react';
import type { DetailTab, ReelInsights, ReelPost, RetentionPoint } from '../types';
import { createId } from '../lib/id';
import { analyzeHook } from '../lib/hookAnalysis';
import { buildPostAnalysis, formatNum } from '../lib/analysis';
import { validateRetentionPoint } from '../lib/retention';
import { RetentionChart } from './RetentionChart';

interface Props {
  post: ReelPost;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onChange: (post: ReelPost) => void;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: '概要' },
  { id: 'insights', label: 'インサイト' },
  { id: 'retention', label: '維持率' },
  { id: 'hook', label: 'フック' },
  { id: 'analysis', label: '分析' },
];

export function PostDetail({ post, tab, onTab, onChange, onEdit, onDelete, onBack }: Props) {
  const openIg = () => {
    if (!post.url.trim()) return;
    window.open(post.url.trim(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="brand">Reel Hook Analyzer</p>
          <h1>{post.title.trim() || '（無題）'}</h1>
          <p className="lede">
            {post.theme && <span>{post.theme} · </span>}
            {post.postedAt ? post.postedAt.replace('T', ' ').slice(0, 16) : '投稿日未設定'}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={onBack}>
            一覧
          </button>
          {post.url.trim() ? (
            <button type="button" className="btn btn-primary" onClick={openIg}>
              Instagramで開く
            </button>
          ) : (
            <span className="hint">URL未設定</span>
          )}
          <button type="button" className="btn" onClick={onEdit}>
            編集
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            削除
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="詳細タブ">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview post={post} />}
      {tab === 'insights' && (
        <InsightsForm
          insights={post.insights}
          onSave={(insights) => onChange({ ...post, insights, updatedAt: new Date().toISOString() })}
        />
      )}
      {tab === 'retention' && (
        <RetentionForm
          post={post}
          onSave={(retention) =>
            onChange({ ...post, retention, updatedAt: new Date().toISOString() })
          }
        />
      )}
      {tab === 'hook' && <HookPanel post={post} />}
      {tab === 'analysis' && <AnalysisPanel post={post} />}
    </div>
  );
}

function Overview({ post }: { post: ReelPost }) {
  return (
    <div className="stack">
      <section className="section">
        <h2>フック</h2>
        <p className="quote">{post.hookText.trim() || '未入力'}</p>
      </section>
      <section className="section">
        <h2>基本情報</h2>
        <dl className="kv">
          <div>
            <dt>長さ</dt>
            <dd>{post.durationSec === null ? '—' : `${post.durationSec} 秒`}</dd>
          </div>
          <div>
            <dt>形式</dt>
            <dd>{post.format || '—'}</dd>
          </div>
          <div>
            <dt>CTA</dt>
            <dd>{post.cta || '—'}</dd>
          </div>
          <div>
            <dt>再生</dt>
            <dd>{formatNum(post.insights.views)}</dd>
          </div>
          <div>
            <dt>リーチ</dt>
            <dd>{formatNum(post.insights.reach)}</dd>
          </div>
          <div>
            <dt>平均再生</dt>
            <dd>
              {post.insights.avgWatchSec === null ? '—' : `${post.insights.avgWatchSec} 秒`}
            </dd>
          </div>
        </dl>
      </section>
      {post.memo.trim() && (
        <section className="section">
          <h2>メモ</h2>
          <p className="pre">{post.memo}</p>
        </section>
      )}
      {post.script.trim() && (
        <section className="section">
          <h2>台本・字幕</h2>
          <pre className="script-block">{post.script}</pre>
        </section>
      )}
    </div>
  );
}

const INSIGHT_FIELDS: {
  key: keyof ReelInsights;
  label: string;
  hint: string;
  step?: string;
}[] = [
  {
    key: 'views',
    label: '再生数 / ビュー',
    hint: 'リールのインサイト画面で確認（再生数またはビュー）。',
  },
  {
    key: 'reach',
    label: 'リーチ',
    hint: 'インサイトの「リーチ」。アカウント権限がある投稿のみ。',
  },
  {
    key: 'avgWatchSec',
    label: '平均再生時間（秒）',
    hint: 'インサイトの平均再生時間。秒に換算して入力。',
    step: '0.1',
  },
  {
    key: 'skipRate',
    label: 'スキップ率（%）',
    hint: '表示されている場合のみ。なければ空欄のまま。',
    step: '0.1',
  },
  { key: 'likes', label: 'いいね', hint: '投稿のいいね数。' },
  { key: 'comments', label: 'コメント', hint: 'コメント数。' },
  { key: 'saves', label: '保存', hint: 'インサイトの保存数。' },
  { key: 'shares', label: 'シェア', hint: 'インサイトのシェア数。' },
  {
    key: 'profileVisits',
    label: 'プロフィールへのアクセス',
    hint: 'インサイトのプロフィールアクセス。',
  },
  { key: 'follows', label: 'フォロー数', hint: 'この投稿経由のフォロー（表示時）。' },
];

function InsightsForm({
  insights,
  onSave,
}: {
  insights: ReelInsights;
  onSave: (i: ReelInsights) => void;
}) {
  const [local, setLocal] = useState<ReelInsights>({ ...insights });
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof ReelInsights, raw: string) => {
    setSaved(false);
    if (raw.trim() === '') {
      setLocal((s) => ({ ...s, [key]: null }));
      return;
    }
    const n = Number(raw);
    setLocal((s) => ({ ...s, [key]: Number.isFinite(n) ? n : null }));
  };

  return (
    <div className="stack">
      <div className="callout">
        空欄は「未入力」、0は「ゼロ」として区別して保存します。Instagramアプリのインサイトを見ながら入力してください。
      </div>
      <div className="stack-form">
        {INSIGHT_FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type="number"
              min={0}
              step={f.step ?? '1'}
              value={local[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder="未入力"
            />
            <span className="field-hint">{f.hint}</span>
          </label>
        ))}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(local);
              setSaved(true);
            }}
          >
            インサイトを保存
          </button>
          {saved && <span className="ok-text">保存しました</span>}
        </div>
      </div>
    </div>
  );
}

function RetentionForm({
  post,
  onSave,
}: {
  post: ReelPost;
  onSave: (r: RetentionPoint[]) => void;
}) {
  const [rows, setRows] = useState<RetentionPoint[]>(
    post.retention.length
      ? post.retention.map((r) => ({ ...r }))
      : [
          { id: createId(), timeSec: 0, percent: 100 },
          { id: createId(), timeSec: 2, percent: 72 },
        ],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const updateRow = (id: string, patch: Partial<RetentionPoint>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setSaved(false);
    setRows((rs) => [...rs, { id: createId(), timeSec: 0, percent: 100 }]);
  };

  const removeRow = (id: string) => {
    setSaved(false);
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    const errs: string[] = [];
    for (const r of rows) {
      errs.push(...validateRetentionPoint(r, post.durationSec).map((e) => `${r.timeSec}s: ${e}`));
    }
    const times = rows.map((r) => r.timeSec);
    if (new Set(times).size !== times.length) {
      errs.push('同じ時刻の行が重複しています。');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    onSave(rows);
    setSaved(true);
  };

  return (
    <div className="stack">
      <div className="callout">
        Instagramの視聴者維持率グラフを見ながら、時刻と視聴者割合を入力します。自動取得はしません。
        {post.durationSec === null && ' 動画の長さが未設定のため、長さチェックは緩くなります。'}
      </div>

      {errors.length > 0 && (
        <div className="callout callout-error">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div className="retention-editor">
        {rows.map((r) => (
          <div className="retention-row" key={r.id}>
            <label>
              時刻（秒）
              <input
                type="number"
                min={0}
                step={0.1}
                value={r.timeSec}
                onChange={(e) => updateRow(r.id, { timeSec: Number(e.target.value) })}
              />
            </label>
            <label>
              視聴者（%）
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={r.percent}
                onChange={(e) => updateRow(r.id, { percent: Number(e.target.value) })}
              />
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => removeRow(r.id)}>
              削除
            </button>
          </div>
        ))}
        <div className="form-actions">
          <button type="button" className="btn" onClick={addRow}>
            行を追加
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            維持率を保存
          </button>
          {saved && <span className="ok-text">保存しました</span>}
        </div>
      </div>

      <p className="hint">
        下のグラフは入力内容のプレビューです。反映を確定するには「維持率を保存」を押してください。
      </p>
      <RetentionChart points={rows} durationSec={post.durationSec} script={post.script} />
    </div>
  );
}

function HookPanel({ post }: { post: ReelPost }) {
  const result = analyzeHook(post.hookText);
  return (
    <div className="stack">
      <div className="callout callout-warn">
        以下はルールベースの<strong>参考評価</strong>です。伸びを保証・断定するものではありません。
      </div>
      <section className="section">
        <h2>フック文</h2>
        <p className="quote">{post.hookText.trim() || '未入力'}</p>
        <p>{result.summary}</p>
      </section>
      {result.criteria.length > 0 && (
        <ul className="criteria-list">
          {result.criteria.map((c) => (
            <li key={c.id} className={`criterion level-${c.level}`}>
              <div className="criterion-head">
                <strong>{c.label}</strong>
                <span className="badge">
                  {c.level === 'good' ? '良好' : c.level === 'ok' ? '普通' : '弱い'}
                </span>
              </div>
              <p>{c.reason}</p>
            </li>
          ))}
        </ul>
      )}
      {result.suggestions.length > 0 && (
        <section className="section">
          <h2>改善案（意図を保つ範囲・最大3つ）</h2>
          <ol className="suggestions">
            {result.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function AnalysisPanel({ post }: { post: ReelPost }) {
  const a = buildPostAnalysis(post);
  return (
    <div className="stack">
      <div className={`callout ${a.dropIsEstimated ? 'callout-warn' : 'callout-drop'}`}>
        <strong>{a.dropIsEstimated ? '離脱について（推定）' : '離脱について（実測）'}</strong>
        <p>{a.dropNote}</p>
      </div>
      <section className="section">
        <h2>実測データから分かること</h2>
        <ul>
          {a.measured.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      <section className="section">
        <h2>考えられる理由・仮説</h2>
        <ul>
          {a.hypotheses.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      <section className="section">
        <h2>次の投稿で試すこと</h2>
        <ol>
          {a.nextExperiments.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </section>
      <section className="section">
        <h2>追加すると分析しやすくなるデータ</h2>
        {a.missingData.length === 0 ? (
          <p>主要な項目は揃っています。</p>
        ) : (
          <ul>
            {a.missingData.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
