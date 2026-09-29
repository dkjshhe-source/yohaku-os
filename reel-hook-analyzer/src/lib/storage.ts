import type { AppData, ReelPost } from '../types';
import { emptyInsights } from '../types';
import { createId } from './id';

const STORAGE_KEY = 'reel-hook-analyzer:v1';

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, posts: [] };
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.posts)) {
      return { version: 1, posts: [] };
    }
    return {
      version: 1,
      posts: parsed.posts.map(normalizePost),
    };
  } catch {
    return { version: 1, posts: [] };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizePost(p: Partial<ReelPost>): ReelPost {
  return {
    id: p.id || createId(),
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
    url: p.url ?? '',
    title: p.title ?? '',
    postedAt: p.postedAt ?? '',
    durationSec: p.durationSec ?? null,
    hookText: p.hookText ?? '',
    script: p.script ?? '',
    cta: p.cta ?? '',
    theme: p.theme ?? '',
    format: p.format ?? '',
    memo: p.memo ?? '',
    insights: { ...emptyInsights(), ...(p.insights ?? {}) },
    retention: Array.isArray(p.retention)
      ? p.retention.map((r) => ({
          id: r.id || createId(),
          timeSec: Number(r.timeSec) || 0,
          percent: Number(r.percent) || 0,
        }))
      : [],
  };
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function parseImportJson(text: string): ReelPost[] {
  const parsed = JSON.parse(text) as AppData | ReelPost[] | ReelPost;
  if (Array.isArray(parsed)) {
    return parsed.map(normalizePost);
  }
  if (parsed && typeof parsed === 'object' && 'posts' in parsed && Array.isArray(parsed.posts)) {
    return (parsed as AppData).posts.map(normalizePost);
  }
  if (parsed && typeof parsed === 'object' && 'id' in parsed) {
    return [normalizePost(parsed as ReelPost)];
  }
  throw new Error('JSONの形式が不正です。posts配列、または投稿オブジェクトが必要です。');
}

const CSV_HEADERS = [
  'id',
  'title',
  'url',
  'postedAt',
  'durationSec',
  'hookText',
  'script',
  'cta',
  'theme',
  'format',
  'memo',
  'views',
  'reach',
  'avgWatchSec',
  'skipRate',
  'likes',
  'comments',
  'saves',
  'shares',
  'profileVisits',
  'follows',
  'retention',
  'createdAt',
  'updatedAt',
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function numToCsv(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

export function exportCsv(data: AppData): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const p of data.posts) {
    const retention = p.retention
      .map((r) => `${r.timeSec}:${r.percent}`)
      .join('|');
    const row = [
      p.id,
      p.title,
      p.url,
      p.postedAt,
      numToCsv(p.durationSec),
      p.hookText,
      p.script,
      p.cta,
      p.theme,
      p.format,
      p.memo,
      numToCsv(p.insights.views),
      numToCsv(p.insights.reach),
      numToCsv(p.insights.avgWatchSec),
      numToCsv(p.insights.skipRate),
      numToCsv(p.insights.likes),
      numToCsv(p.insights.comments),
      numToCsv(p.insights.saves),
      numToCsv(p.insights.shares),
      numToCsv(p.insights.profileVisits),
      numToCsv(p.insights.follows),
      retention,
      p.createdAt,
      p.updatedAt,
    ].map((v) => csvEscape(String(v ?? '')));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

/** Split CSV text into records, honoring quoted newlines. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\n') {
      row.push(current);
      current = '';
      if (row.some((c) => c.trim() !== '')) records.push(row);
      row = [];
    } else if (ch === '\r') {
      // ignore; handle \r\n via \n
    } else {
      current += ch;
    }
  }

  row.push(current);
  if (row.some((c) => c.trim() !== '')) records.push(row);
  return records;
}

function parseNullable(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseImportCsv(text: string): ReelPost[] {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ''));
  if (records.length < 2) throw new Error('CSVにデータ行がありません。');
  const headers = records[0].map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  return records.slice(1).map((cols) => {
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? cols[i] ?? '' : '';
    };
    const retentionRaw = get('retention');
    const retention = retentionRaw
      ? retentionRaw.split('|').filter(Boolean).map((pair) => {
          const [t, p] = pair.split(':');
          return {
            id: createId(),
            timeSec: Number(t) || 0,
            percent: Number(p) || 0,
          };
        })
      : [];

    return normalizePost({
      id: get('id') || createId(),
      title: get('title'),
      url: get('url'),
      postedAt: get('postedAt'),
      durationSec: parseNullable(get('durationSec')),
      hookText: get('hookText'),
      script: get('script'),
      cta: get('cta'),
      theme: get('theme'),
      format: get('format'),
      memo: get('memo'),
      insights: {
        views: parseNullable(get('views')),
        reach: parseNullable(get('reach')),
        avgWatchSec: parseNullable(get('avgWatchSec')),
        skipRate: parseNullable(get('skipRate')),
        likes: parseNullable(get('likes')),
        comments: parseNullable(get('comments')),
        saves: parseNullable(get('saves')),
        shares: parseNullable(get('shares')),
        profileVisits: parseNullable(get('profileVisits')),
        follows: parseNullable(get('follows')),
      },
      retention,
      createdAt: get('createdAt') || undefined,
      updatedAt: get('updatedAt') || undefined,
    });
  });
}

export interface ImportPreview {
  incoming: ReelPost[];
  newCount: number;
  duplicateIds: string[];
  duplicateTitles: string[];
}

export function previewImport(
  existing: ReelPost[],
  incoming: ReelPost[],
): ImportPreview {
  const existingIds = new Set(existing.map((p) => p.id));
  const existingTitles = new Map(
    existing.filter((p) => p.title.trim()).map((p) => [p.title.trim().toLowerCase(), p.id]),
  );
  const duplicateIds = incoming.filter((p) => existingIds.has(p.id)).map((p) => p.id);
  const duplicateTitles = incoming
    .filter((p) => {
      const t = p.title.trim().toLowerCase();
      return t && existingTitles.has(t) && !existingIds.has(p.id);
    })
    .map((p) => p.title);

  return {
    incoming,
    newCount: incoming.length - duplicateIds.length,
    duplicateIds,
    duplicateTitles,
  };
}

export type ImportMode = 'skip' | 'overwrite' | 'asNew';

export function applyImport(
  existing: ReelPost[],
  incoming: ReelPost[],
  mode: ImportMode,
): ReelPost[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const result = [...existing];

  for (const post of incoming) {
    if (byId.has(post.id)) {
      if (mode === 'skip') continue;
      if (mode === 'overwrite') {
        const idx = result.findIndex((p) => p.id === post.id);
        if (idx >= 0) {
          result[idx] = { ...post, updatedAt: new Date().toISOString() };
        }
      } else {
        const asNew = {
          ...post,
          id: createId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        result.push(asNew);
      }
    } else {
      result.push({
        ...post,
        createdAt: post.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return result;
}
