import { useMemo, useState } from 'react';
import type { ReelPost } from '../types';
import { formatNum } from '../lib/analysis';
import { analyzeRetention } from '../lib/retention';
import { DropBadge } from './RetentionChart';

interface Props {
  posts: ReelPost[];
  onBack: () => void;
  onOpen: (id: string) => void;
}

export function CompareView({ posts, onBack, onOpen }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState('');

  const themes = useMemo(() => {
    const set = new Set(posts.map((p) => p.theme.trim()).filter(Boolean));
    return [...set].sort();
  }, [posts]);

  const visible = themeFilter
    ? posts.filter((p) => p.theme.trim() === themeFilter)
    : posts;

  const compared = posts.filter((p) => selected.includes(p.id));

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-4)));
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="brand">Reel Hook Analyzer</p>
          <h1>投稿比較</h1>
          <p className="lede">最大4件まで選択して横並び比較できます。再生数だけで優劣は断定しません。</p>
        </div>
        <button type="button" className="btn" onClick={onBack}>
          一覧へ
        </button>
      </header>

      {posts.length < 5 && posts.length > 0 && (
        <div className="callout callout-warn">
          データが少ないため参考値です。傾向の断定は避けてください。
        </div>
      )}

      <div className="toolbar">
        <label>
          テーマ絞り込み
          <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
            <option value="">すべて</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="select-list">
        {visible.map((p) => (
          <li key={p.id}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span>
                <strong>{p.title.trim() || '（無題）'}</strong>
                <span className="muted">
                  {' '}
                  · 再生 {formatNum(p.insights.views)} · <DropBadge post={p} />
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {compared.length === 0 ? (
        <div className="empty-state">
          <p>比較する投稿にチェックを入れてください。</p>
        </div>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>項目</th>
                {compared.map((p) => (
                  <th key={p.id}>
                    <button type="button" className="linkish" onClick={() => onOpen(p.id)}>
                      {p.title.trim() || '（無題）'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="フック文" values={compared.map((p) => p.hookText || '—')} />
              <CompareRow
                label="投稿日時"
                values={compared.map((p) =>
                  p.postedAt ? p.postedAt.replace('T', ' ').slice(0, 16) : '—',
                )}
              />
              <CompareRow label="テーマ" values={compared.map((p) => p.theme || '—')} />
              <CompareRow
                label="再生数"
                values={compared.map((p) => formatNum(p.insights.views))}
              />
              <CompareRow
                label="リーチ"
                values={compared.map((p) => formatNum(p.insights.reach))}
              />
              <CompareRow
                label="平均再生時間"
                values={compared.map((p) =>
                  p.insights.avgWatchSec === null ? '—' : `${p.insights.avgWatchSec}s`,
                )}
              />
              <CompareRow
                label="リールの長さ"
                values={compared.map((p) =>
                  p.durationSec === null ? '—' : `${p.durationSec}s`,
                )}
              />
              <CompareRow
                label="保存"
                values={compared.map((p) => formatNum(p.insights.saves))}
              />
              <CompareRow
                label="シェア"
                values={compared.map((p) => formatNum(p.insights.shares))}
              />
              <CompareRow
                label="フォロー"
                values={compared.map((p) => formatNum(p.insights.follows))}
              />
              <CompareRow
                label="維持率データ"
                values={compared.map((p) =>
                  p.retention.length >= 2
                    ? `${p.retention.length}点`
                    : p.retention.length === 1
                      ? '1点（不足）'
                      : 'なし',
                )}
              />
              <CompareRow
                label="最大離脱区間"
                values={compared.map((p) => {
                  const d = analyzeRetention(p.retention, p.durationSec).largestDrop;
                  return d
                    ? `${d.fromSec}–${d.toSec}s (−${d.drop.toFixed(0)}pt)`
                    : '—（未計測）';
                })}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {values.map((v, i) => (
        <td key={`${label}-${i}`}>{v}</td>
      ))}
    </tr>
  );
}
