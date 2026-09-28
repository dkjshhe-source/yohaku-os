import { useMemo, useState } from 'react';
import type { ReelPost } from '../types';
import { createEmptyPost } from '../types';
import { createId } from '../lib/id';
import { DropBadge } from './RetentionChart';
import { formatNum } from '../lib/analysis';

type SortKey = 'postedAt' | 'views' | 'title' | 'theme';

interface Props {
  posts: ReelPost[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onCompare: () => void;
  onData: () => void;
}

export function PostList({ posts, onOpen, onNew, onCompare, onData }: Props) {
  const [themeFilter, setThemeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('postedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const themes = useMemo(() => {
    const set = new Set(posts.map((p) => p.theme.trim()).filter(Boolean));
    return [...set].sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let list = [...posts];
    if (themeFilter) {
      list = list.filter((p) => p.theme.trim() === themeFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'postedAt') {
        cmp = (a.postedAt || '').localeCompare(b.postedAt || '');
      } else if (sortKey === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '', 'ja');
      } else if (sortKey === 'theme') {
        cmp = (a.theme || '').localeCompare(b.theme || '', 'ja');
      } else if (sortKey === 'views') {
        const av = a.insights.views;
        const bv = b.insights.views;
        if (av === null && bv === null) cmp = 0;
        else if (av === null) cmp = 1;
        else if (bv === null) cmp = -1;
        else cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [posts, themeFilter, sortKey, sortDir]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="brand">Reel Hook Analyzer</p>
          <h1>投稿一覧</h1>
          <p className="lede">
            Instagramリールのフックと離脱ポイントを、手入力データから整理します。外部へは送信しません。
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={onNew}>
            新規登録
          </button>
          <button type="button" className="btn" onClick={onCompare}>
            比較
          </button>
          <button type="button" className="btn" onClick={onData}>
            データ
          </button>
        </div>
      </header>

      {posts.length > 0 && posts.length < 5 && (
        <div className="callout callout-warn">
          投稿数が少ないため、傾向は断定せず参考値として扱ってください。再生数だけで良し悪しは判定しません。
        </div>
      )}

      <div className="toolbar">
        <label>
          テーマ
          <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
            <option value="">すべて</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          並べ替え
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="postedAt">投稿日</option>
            <option value="views">再生数</option>
            <option value="theme">テーマ</option>
            <option value="title">タイトル</option>
          </select>
        </label>
        <label>
          順
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>まだ投稿がありません。Instagramを見ながら手入力で登録できます（URLは任意）。</p>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            最初のリールを登録
          </button>
        </div>
      ) : (
        <ul className="post-list">
          {filtered.map((p) => (
            <li key={p.id}>
              <button type="button" className="post-row" onClick={() => onOpen(p.id)}>
                <div className="post-row-main">
                  <strong>{p.title.trim() || '（無題）'}</strong>
                  <span className="muted">
                    {p.postedAt ? p.postedAt.replace('T', ' ').slice(0, 16) : '投稿日未設定'}
                    {p.theme ? ` · ${p.theme}` : ''}
                  </span>
                  <span className="hook-preview">{p.hookText.trim() || 'フック未入力'}</span>
                </div>
                <div className="post-row-meta">
                  <span>再生 {formatNum(p.insights.views)}</span>
                  <span>リーチ {formatNum(p.insights.reach)}</span>
                  <DropBadge post={p} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FormProps {
  initial?: ReelPost;
  onSave: (post: ReelPost) => void;
  onCancel: () => void;
}

export function PostForm({ initial, onSave, onCancel }: FormProps) {
  const blank = createEmptyPost();
  const [form, setForm] = useState(() =>
    initial
      ? { ...initial }
      : {
          ...blank,
          id: createId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
  );
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof ReelPost>(key: K, value: ReelPost[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (form.durationSec !== null && (form.durationSec < 0 || !Number.isFinite(form.durationSec))) {
      errs.push('リールの長さは0以上の数値にしてください。');
    }
    if (form.url.trim() && !/^https?:\/\//i.test(form.url.trim())) {
      errs.push('URLは http(s):// から始まる形式にしてください（空欄でも登録可）。');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    onSave({ ...form, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="brand">Reel Hook Analyzer</p>
          <h1>{initial ? '投稿を編集' : 'リール登録'}</h1>
          <p className="lede">URLは任意。Instagramから自動取得はしません。見ながら手入力してください。</p>
        </div>
        <button type="button" className="btn" onClick={onCancel}>
          戻る
        </button>
      </header>

      {errors.length > 0 && (
        <div className="callout callout-error">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          InstagramリールURL
          <input
            type="url"
            value={form.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://www.instagram.com/reel/…（空欄可）"
          />
          <span className="field-hint">記録と「Instagramで開く」用。内容の自動取得はしません。</span>
        </label>
        <label>
          投稿タイトル
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="管理用の名前"
          />
        </label>
        <label>
          投稿日時
          <input
            type="datetime-local"
            value={form.postedAt}
            onChange={(e) => set('postedAt', e.target.value)}
          />
        </label>
        <label>
          リールの長さ（秒）
          <input
            type="number"
            min={0}
            step={0.1}
            value={form.durationSec ?? ''}
            onChange={(e) =>
              set('durationSec', e.target.value === '' ? null : Number(e.target.value))
            }
            placeholder="未入力"
          />
          <span className="field-hint">空欄は未入力です。0とは区別されます。</span>
        </label>
        <label>
          冒頭のフック文
          <textarea
            rows={3}
            value={form.hookText}
            onChange={(e) => set('hookText', e.target.value)}
            placeholder="最初の表示・発話"
          />
        </label>
        <label>
          台本・字幕
          <textarea
            rows={5}
            value={form.script}
            onChange={(e) => set('script', e.target.value)}
            placeholder={'時刻付き推奨例:\n0:00 フック\n0:05 本編\n0:20 CTA'}
          />
        </label>
        <label>
          CTA（最後の行動喚起）
          <input type="text" value={form.cta} onChange={(e) => set('cta', e.target.value)} />
        </label>
        <div className="grid-2">
          <label>
            テーマ
            <input type="text" value={form.theme} onChange={(e) => set('theme', e.target.value)} />
          </label>
          <label>
            投稿形式
            <input
              type="text"
              value={form.format}
              onChange={(e) => set('format', e.target.value)}
              placeholder="トーク / テロップ / デモ など"
            />
          </label>
        </div>
        <label>
          メモ
          <textarea rows={3} value={form.memo} onChange={(e) => set('memo', e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            保存
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
