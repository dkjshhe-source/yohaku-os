/**
 * Quick verification of core analysis / storage helpers (Node, no browser).
 * Run: npx --yes tsx scripts/verify-core.ts
 */
import {
  analyzeRetention,
  scriptAtTime,
  estimateDropFromAvgWatch,
  validateRetentionPoint,
} from '../src/lib/retention.ts';
import { analyzeHook } from '../src/lib/hookAnalysis.ts';
import {
  exportJson,
  parseImportJson,
  exportCsv,
  parseImportCsv,
  previewImport,
  applyImport,
} from '../src/lib/storage.ts';
import type { ReelPost } from '../src/types.ts';
import { emptyInsights } from '../src/types.ts';
import { buildPostAnalysis } from '../src/lib/analysis.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const points = [
  { id: '1', timeSec: 0, percent: 100 },
  { id: '2', timeSec: 2, percent: 72 },
  { id: '3', timeSec: 5, percent: 51 },
  { id: '4', timeSec: 10, percent: 34 },
];

const ret = analyzeRetention(points, 15);
assert(ret.largestDrop, 'largest drop expected');
assert(ret.largestDrop!.fromSec === 0 && ret.largestDrop!.toSec === 2, 'largest drop should be 0-2s');
assert(Math.abs(ret.largestDrop!.drop - 28) < 0.01, 'drop width 28');

assert(validateRetentionPoint({ timeSec: 20, percent: 50 }, 15).length >= 1, 'time over duration');
assert(validateRetentionPoint({ timeSec: 1, percent: 120 }, 15).length >= 1, 'percent over 100');

const invalid = analyzeRetention([{ id: 'x', timeSec: 20, percent: 120 }], 15);
assert(invalid.errors.length >= 2, 'should flag time and percent');

assert(scriptAtTime('ただの字幕', 2) === null, 'untimed script must not map');
assert(scriptAtTime('0:00 フック\n0:05 本編', 2)?.includes('フック'), 'timed map');
assert(scriptAtTime('5秒: CTA付近', 5)?.includes('CTA'), 'jp sec map');

const est = estimateDropFromAvgWatch(4, 20);
assert(est.estimated, 'estimation flag');
assert(est.note.includes('推定'), 'must say estimated');
assert(est.note.includes('断定できません'), 'must not claim definitive drop');
assert(est.note.includes('正確な離脱時刻は表示しません'), 'no exact drop time displayed');

const hook = analyzeHook('フォロワーが伸びない人へ、再生が止まる本当の理由');
assert(hook.suggestions.length === 3, '3 suggestions');
assert(hook.isReference, 'reference only');

const emptyHook = analyzeHook('');
assert(emptyHook.criteria.length === 0, 'empty hook');

const sample: ReelPost = {
  id: 'post-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: 'https://www.instagram.com/reel/ABC/',
  title: 'Test Reel',
  postedAt: '2026-01-01T12:00',
  durationSec: 15,
  hookText: '忙しい会社員向け、夜の準備を10分短縮する方法',
  script: '0:00 フック\n0:03 問題\n0:10 CTA',
  cta: '保存して後で試す',
  theme: '時短',
  format: 'トーク',
  memo: '',
  insights: {
    ...emptyInsights(),
    views: 1000,
    reach: 800,
    avgWatchSec: 5,
    likes: 0,
    saves: 40,
    shares: null,
    follows: 3,
    comments: null,
    skipRate: null,
    profileVisits: null,
  },
  retention: points,
};

assert(sample.insights.likes === 0, 'zero likes stored');
assert(sample.insights.shares === null, 'null shares distinct from zero');

const analysis = buildPostAnalysis(sample);
assert(!analysis.dropIsEstimated, 'has retention so measured');
assert(analysis.dropNote.includes('実測'), 'measured drop note');

const noRet: ReelPost = {
  ...sample,
  id: 'post-2',
  retention: [],
  insights: { ...sample.insights, likes: null },
};
const analysis2 = buildPostAnalysis(noRet);
assert(analysis2.dropIsEstimated, 'no retention => estimated');
assert(analysis2.dropNote.includes('推定'), 'estimated wording');
assert(!/離脱が大きい時刻帯は/.test(analysis2.dropNote), 'must not assert drop clock time');

const json = exportJson({ version: 1, posts: [sample] });
const parsed = parseImportJson(json);
assert(parsed.length === 1 && parsed[0].insights.likes === 0, 'json roundtrip keeps 0');
assert(parsed[0].insights.shares === null, 'json roundtrip keeps null');

const csv = exportCsv({ version: 1, posts: [sample] });
const fromCsv = parseImportCsv(csv);
assert(fromCsv[0].insights.likes === 0, 'csv keeps 0');
assert(fromCsv[0].insights.shares === null, 'csv empty -> null');

const preview = previewImport([sample], [{ ...sample, title: 'dup' }]);
assert(preview.duplicateIds.length === 1, 'detect duplicate id');
const skipped = applyImport([sample], [{ ...sample, title: 'dup' }], 'skip');
assert(skipped.length === 1 && skipped[0].title === 'Test Reel', 'skip keeps existing');
const overwritten = applyImport([sample], [{ ...sample, title: 'dup' }], 'overwrite');
assert(overwritten[0].title === 'dup', 'overwrite works');
const asNew = applyImport([sample], [{ ...sample, title: 'dup' }], 'asNew');
assert(asNew.length === 2, 'asNew adds');

console.log('All core verifications passed.');
