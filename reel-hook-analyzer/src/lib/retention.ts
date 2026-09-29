import type { RetentionPoint } from '../types';

export interface DropSegment {
  fromSec: number;
  toSec: number;
  fromPercent: number;
  toPercent: number;
  drop: number;
}

export interface RetentionAnalysis {
  hasData: boolean;
  sorted: RetentionPoint[];
  largestDrop: DropSegment | null;
  opening0to3: {
    startPercent: number | null;
    endPercent: number | null;
    drop: number | null;
    note: string;
  };
  errors: string[];
}

export function validateRetentionPoint(
  point: { timeSec: number; percent: number },
  durationSec: number | null,
): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(point.timeSec) || point.timeSec < 0) {
    errors.push('時刻は0以上の数値にしてください。');
  }
  if (durationSec !== null && point.timeSec > durationSec) {
    errors.push(`時刻は動画の長さ（${durationSec}秒）以内にしてください。`);
  }
  if (!Number.isFinite(point.percent) || point.percent < 0 || point.percent > 100) {
    errors.push('割合は0〜100の範囲にしてください。');
  }
  return errors;
}

export function analyzeRetention(
  points: RetentionPoint[],
  durationSec: number | null,
): RetentionAnalysis {
  const errors: string[] = [];
  for (const p of points) {
    errors.push(...validateRetentionPoint(p, durationSec).map((e) => `${p.timeSec}秒: ${e}`));
  }

  const sorted = [...points].sort((a, b) => a.timeSec - b.timeSec || a.percent - b.percent);
  if (sorted.length < 2) {
    return {
      hasData: sorted.length > 0,
      sorted,
      largestDrop: null,
      opening0to3: {
        startPercent: sorted.find((p) => p.timeSec === 0)?.percent ?? null,
        endPercent: null,
        drop: null,
        note:
          sorted.length === 0
            ? '維持率データが未入力です。離脱時刻は断定できません。'
            : '離脱区間の算出には2点以上の維持率が必要です。',
      },
      errors,
    };
  }

  let largestDrop: DropSegment | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const drop = a.percent - b.percent;
    if (drop > 0 && (!largestDrop || drop > largestDrop.drop)) {
      largestDrop = {
        fromSec: a.timeSec,
        toSec: b.timeSec,
        fromPercent: a.percent,
        toPercent: b.percent,
        drop,
      };
    }
  }

  const at0 = sorted.find((p) => p.timeSec === 0) ?? sorted[0];
  const around3 =
    sorted.find((p) => p.timeSec >= 3) ??
    sorted.filter((p) => p.timeSec <= 3).at(-1) ??
    null;

  let openingNote = '';
  let drop: number | null = null;
  if (at0 && around3 && around3.timeSec !== at0.timeSec) {
    drop = at0.percent - around3.percent;
    if (drop >= 30) {
      openingNote = `冒頭${at0.timeSec}〜${around3.timeSec}秒で約${drop.toFixed(0)}pt減少。フックの見直し候補です（参考値）。`;
    } else if (drop >= 15) {
      openingNote = `冒頭${at0.timeSec}〜${around3.timeSec}秒で約${drop.toFixed(0)}pt減少。やや離脱があります（参考値）。`;
    } else {
      openingNote = `冒頭${at0.timeSec}〜${around3.timeSec}秒の維持は比較的安定しています（参考値）。`;
    }
  } else {
    openingNote = '0〜3秒付近の比較に十分な維持率ポイントがありません。';
  }

  return {
    hasData: true,
    sorted,
    largestDrop,
    opening0to3: {
      startPercent: at0?.percent ?? null,
      endPercent: around3?.percent ?? null,
      drop,
      note: openingNote,
    },
    errors,
  };
}

/**
 * Only maps time → script when the script has explicit timestamps.
 * Never invents correspondence from untimed captions.
 */
export function scriptAtTime(script: string, timeSec: number): string | null {
  if (!script.trim()) return null;

  const timed: { sec: number; text: string }[] = [];

  for (const raw of script.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    let sec: number | null = null;
    let text = '';

    const mmss = line.match(/^\[?\s*(\d{1,2}):(\d{2})\s*\]?\s*[-–—:：]?\s*(.*)$/);
    if (mmss) {
      sec = Number(mmss[1]) * 60 + Number(mmss[2]);
      text = mmss[3].trim();
    } else {
      const secMark = line.match(/^\[?\s*(\d+(?:\.\d+)?)\s*(?:s|sec|秒)\s*\]?\s*[-–—:：]?\s*(.*)$/i);
      if (secMark) {
        sec = Number(secMark[1]);
        text = secMark[2].trim();
      }
    }

    if (sec === null || !Number.isFinite(sec)) continue;
    timed.push({ sec, text: text || line });
  }

  if (timed.length === 0) return null;

  timed.sort((a, b) => a.sec - b.sec);
  let best = timed[0];
  for (const t of timed) {
    if (t.sec <= timeSec) best = t;
    else break;
  }
  return best.text;
}

export function estimateDropFromAvgWatch(
  avgWatchSec: number | null,
  durationSec: number | null,
): { estimated: boolean; note: string } {
  if (avgWatchSec === null) {
    return {
      estimated: true,
      note: '維持率データがなく、平均再生時間も未入力のため、離脱時刻は分かりません。',
    };
  }
  if (durationSec === null || durationSec <= 0) {
    return {
      estimated: true,
      note: `平均再生時間は ${avgWatchSec} 秒です。動画の長さが未登録のため、離脱の推定は限定的です（推定・参考値）。正確な離脱時刻は表示しません。`,
    };
  }
  const ratio = (avgWatchSec / durationSec) * 100;
  return {
    estimated: true,
    note: `維持率データがないため、離脱時刻は断定できません。平均再生時間 ${avgWatchSec} 秒 / 長さ ${durationSec} 秒（約 ${ratio.toFixed(0)}%）からの推定です（推定・参考値）。正確な離脱時刻は表示しません。`,
  };
}
