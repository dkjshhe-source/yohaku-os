import type { ReelPost } from '../types';
import { analyzeRetention, estimateDropFromAvgWatch } from './retention';
import { analyzeHook } from './hookAnalysis';

export interface PostAnalysis {
  measured: string[];
  hypotheses: string[];
  nextExperiments: string[];
  missingData: string[];
  dropNote: string;
  dropIsEstimated: boolean;
}

export function buildPostAnalysis(post: ReelPost): PostAnalysis {
  const measured: string[] = [];
  const hypotheses: string[] = [];
  const nextExperiments: string[] = [];
  const missingData: string[] = [];

  const retention = analyzeRetention(post.retention, post.durationSec);
  const hook = analyzeHook(post.hookText);
  const insights = post.insights;

  if (retention.sorted.length >= 2 && retention.largestDrop) {
    const d = retention.largestDrop;
    measured.push(
      `維持率データ上、最も減少が大きい区間は ${d.fromSec}〜${d.toSec} 秒（${d.fromPercent}% → ${d.toPercent}%、減少 ${d.drop.toFixed(1)}pt）です。`,
    );
    measured.push(retention.opening0to3.note);
  } else if (retention.sorted.length > 0) {
    measured.push('維持率ポイントは登録されていますが、区間比較には2点以上必要です。');
  }

  if (insights.views !== null) measured.push(`再生数/ビュー: ${insights.views.toLocaleString()}`);
  if (insights.reach !== null) measured.push(`リーチ: ${insights.reach.toLocaleString()}`);
  if (insights.avgWatchSec !== null) measured.push(`平均再生時間: ${insights.avgWatchSec} 秒`);
  if (insights.saves !== null) measured.push(`保存: ${insights.saves.toLocaleString()}`);
  if (insights.shares !== null) measured.push(`シェア: ${insights.shares.toLocaleString()}`);
  if (insights.follows !== null) measured.push(`フォロー: ${insights.follows.toLocaleString()}`);

  if (measured.length === 0) {
    measured.push('実測として表示できる数値・維持率データがまだありません。');
  }

  let dropNote: string;
  let dropIsEstimated: boolean;
  if (retention.largestDrop) {
    dropIsEstimated = false;
    dropNote = `実測の維持率より、離脱が大きい時刻帯は ${retention.largestDrop.fromSec}〜${retention.largestDrop.toSec} 秒付近です。`;
  } else {
    const est = estimateDropFromAvgWatch(insights.avgWatchSec, post.durationSec);
    dropIsEstimated = true;
    dropNote = est.note;
  }

  // Hypotheses (never definitive)
  if (retention.opening0to3.drop !== null && retention.opening0to3.drop >= 25) {
    hypotheses.push(
      '冒頭数秒の減少が大きい場合、フックの対象・悩み・続きの理由が弱い可能性があります（仮説）。',
    );
  }
  if (hook.criteria.some((c) => c.id === 'audience' && c.level === 'weak')) {
    hypotheses.push('フックから対象者が読み取りにくいと、無関係な視聴者の早期離脱につながることがあります（仮説）。');
  }
  if (
    insights.views !== null &&
    insights.saves !== null &&
    insights.views > 0 &&
    insights.saves / insights.views < 0.01
  ) {
    hypotheses.push(
      '再生に対して保存が少ない場合、内容の再利用価値や具体性が弱い可能性があります（仮説・参考）。再生数だけでは良し悪しを判定しません。',
    );
  }
  if (
    insights.avgWatchSec !== null &&
    post.durationSec !== null &&
    post.durationSec > 0 &&
    insights.avgWatchSec / post.durationSec < 0.35
  ) {
    hypotheses.push(
      '平均再生時間が長さに対して短い場合、中盤の冗長さや期待とのギャップが考えられます（仮説・推定）。',
    );
  }
  if (hypotheses.length === 0) {
    hypotheses.push(
      'データが限られているため、強い仮説は立てず、次の投稿で1変数ずつ検証するのが安全です。',
    );
  }

  // Next experiments
  const weakHook = hook.criteria.filter((c) => c.level === 'weak').slice(0, 2);
  if (weakHook.length > 0) {
    nextExperiments.push(
      `フックの「${weakHook[0].label}」を改善した別案を1本投稿し、冒頭維持と保存を比較する。`,
    );
  } else if (post.hookText.trim()) {
    nextExperiments.push('同じテーマでフックの切り口だけ変えた比較投稿を1本作り、維持率を記録する。');
  } else {
    nextExperiments.push('次の投稿ではフック文を必ず記録し、冒頭0/2/5秒の維持率を控える。');
  }

  if (retention.sorted.length < 2) {
    nextExperiments.push(
      'Instagramの視聴者維持率グラフから、少なくとも0秒・大きな段差・終盤の3点を手入力する。',
    );
  } else if (retention.largestDrop) {
    nextExperiments.push(
      `${retention.largestDrop.fromSec}〜${retention.largestDrop.toSec} 秒付近の台本を短くする／予告を前倒しする案を試す。`,
    );
  }

  if (!post.cta.trim()) {
    nextExperiments.push('最後のCTA（保存・コメント・フォローなど）を1つに絞って明示し、対応指標を記録する。');
  } else if (nextExperiments.length < 3) {
    nextExperiments.push('テーマを固定したまま長さだけ変えた投稿で、平均再生時間の変化を見る。');
  }

  // Missing data
  if (!post.hookText.trim()) missingData.push('冒頭のフック文');
  if (post.durationSec === null) missingData.push('リールの長さ（秒）');
  if (retention.sorted.length < 2) missingData.push('視聴維持率（2点以上）');
  if (insights.views === null) missingData.push('再生数/ビュー');
  if (insights.reach === null) missingData.push('リーチ');
  if (insights.avgWatchSec === null) missingData.push('平均再生時間');
  if (insights.saves === null) missingData.push('保存数');
  if (insights.follows === null) missingData.push('フォロー数');
  if (!post.script.trim()) missingData.push('台本・字幕（可能なら時刻付き）');

  return {
    measured,
    hypotheses,
    nextExperiments: nextExperiments.slice(0, 3),
    missingData,
    dropNote,
    dropIsEstimated,
  };
}

export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}
