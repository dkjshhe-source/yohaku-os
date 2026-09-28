import type { ReelPost, RetentionPoint } from '../types';
import { analyzeRetention, scriptAtTime } from '../lib/retention';

interface Props {
  points: RetentionPoint[];
  durationSec: number | null;
  script: string;
  highlightDrop?: boolean;
}

export function RetentionChart({ points, durationSec, script, highlightDrop = true }: Props) {
  const analysis = analyzeRetention(points, durationSec);
  const sorted = analysis.sorted;
  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <p>維持率データがありません。時刻と視聴者割合を追加してください。</p>
      </div>
    );
  }

  const maxTime = Math.max(
    durationSec ?? 0,
    ...sorted.map((p) => p.timeSec),
    1,
  );
  const w = 320;
  const h = 160;
  const pad = { t: 12, r: 12, b: 28, l: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const x = (t: number) => pad.l + (t / maxTime) * iw;
  const y = (p: number) => pad.t + ((100 - p) / 100) * ih;

  const line = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.timeSec)} ${y(p.percent)}`).join(' ');
  const area =
    sorted.length > 0
      ? `${line} L ${x(sorted[sorted.length - 1].timeSec)} ${y(0)} L ${x(sorted[0].timeSec)} ${y(0)} Z`
      : '';

  const drop = analysis.largestDrop;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="retention-svg" role="img" aria-label="視聴維持率グラフ">
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y(p)}
              y2={y(p)}
              className="chart-grid"
            />
            <text x={pad.l - 6} y={y(p) + 3} className="chart-label" textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        {area && <path d={area} className="chart-area" />}
        {line && <path d={line} className="chart-line" fill="none" />}
        {highlightDrop && drop && (
          <rect
            x={x(drop.fromSec)}
            y={pad.t}
            width={Math.max(4, x(drop.toSec) - x(drop.fromSec))}
            height={ih}
            className="chart-drop-zone"
          />
        )}
        {sorted.map((p) => (
          <circle key={p.id} cx={x(p.timeSec)} cy={y(p.percent)} r={3.5} className="chart-point" />
        ))}
        <text x={pad.l} y={h - 6} className="chart-label">
          0s
        </text>
        <text x={w - pad.r} y={h - 6} className="chart-label" textAnchor="end">
          {maxTime}s
        </text>
      </svg>

      {drop ? (
        <div className="callout callout-drop">
          <strong>最大離脱区間（実測）</strong>
          <p>
            {drop.fromSec}〜{drop.toSec} 秒で {drop.fromPercent}% → {drop.toPercent}%（減少{' '}
            {drop.drop.toFixed(1)}pt）
          </p>
        </div>
      ) : (
        <div className="callout">
          <p>
            {sorted.length < 2
              ? '区間の離脱を出すには2点以上の維持率が必要です。'
              : '減少区間は検出されませんでした（維持率が下がっていない）。'}
          </p>
        </div>
      )}

      <div className="callout">
        <strong>冒頭0〜3秒</strong>
        <p>{analysis.opening0to3.note}</p>
      </div>

      <div className="script-map">
        <h4>時刻と台本の対応</h4>
        <ul>
          {sorted.map((p) => {
            const mapped = scriptAtTime(script, p.timeSec);
            return (
              <li key={p.id}>
                <span className="mono">
                  {p.timeSec}s / {p.percent}%
                </span>
                <span>
                  {mapped === null
                    ? 'この時刻の台本は未登録'
                    : mapped}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="hint">
          時刻付き台本（例: <code>0:05 テキスト</code> / <code>5秒: テキスト</code>）がある場合のみ対応づけます。推測はしません。
        </p>
      </div>
    </div>
  );
}

export function DropBadge({ post }: { post: ReelPost }) {
  const a = analyzeRetention(post.retention, post.durationSec);
  if (!a.largestDrop) {
    return <span className="badge badge-muted">維持率なし/不足</span>;
  }
  const d = a.largestDrop;
  return (
    <span className="badge badge-drop">
      {d.fromSec}–{d.toSec}s (−{d.drop.toFixed(0)}pt)
    </span>
  );
}
