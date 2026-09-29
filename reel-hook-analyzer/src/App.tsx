import { useEffect, useRef, useState } from 'react';
import type { AppData, ReelPost, View } from './types';
import { saveData as saveLocal } from './lib/storage';
import { bootstrapData, saveServerData, type StorageMode } from './lib/api';
import { PostForm, PostList } from './components/PostList';
import { PostDetail } from './components/PostDetail';
import { CompareView } from './components/CompareView';
import { DataPanel } from './components/DataPanel';
import './index.css';

export default function App() {
  const [data, setData] = useState<AppData>({ version: 1, posts: [] });
  const [view, setView] = useState<View>({ name: 'list' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mode, setMode] = useState<StorageMode>('loading');
  const [statusMsg, setStatusMsg] = useState('サーバーに接続しています…');
  const [saveError, setSaveError] = useState('');
  const readyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await bootstrapData();
        if (cancelled) return;
        setData(result.data);
        setMode(result.mode);
        if (result.error) {
          setStatusMsg(result.error);
        } else if (result.migrated) {
          setStatusMsg('ブラウザ内のデータをサーバーへ移行しました。');
        } else {
          setStatusMsg(
            result.mode === 'server'
              ? 'サーバーに保存しています（端末を変えても同じデータが見られます）。'
              : 'ブラウザ内保存です。',
          );
        }
        readyRef.current = true;
      } catch (e) {
        if (cancelled) return;
        setMode('error');
        setStatusMsg(e instanceof Error ? e.message : '接続に失敗しました');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    saveLocal(data);
    if (mode !== 'server') return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveServerData(data)
        .then(() => setSaveError(''))
        .catch((e) =>
          setSaveError(e instanceof Error ? e.message : 'サーバー保存に失敗しました'),
        );
    }, 250);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [data, mode]);

  const upsert = (post: ReelPost) => {
    setData((d) => {
      const idx = d.posts.findIndex((p) => p.id === post.id);
      if (idx >= 0) {
        const posts = [...d.posts];
        posts[idx] = post;
        return { ...d, posts };
      }
      return { ...d, posts: [post, ...d.posts] };
    });
    setView({ name: 'detail', postId: post.id, tab: 'overview' });
  };

  const updatePost = (post: ReelPost) => {
    setData((d) => ({
      ...d,
      posts: d.posts.map((p) => (p.id === post.id ? post : p)),
    }));
  };

  const removePost = (id: string) => {
    setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
    setDeleteConfirmId(null);
    setView({ name: 'list' });
  };

  const current =
    view.name === 'detail' || view.name === 'form'
      ? data.posts.find((p) => p.id === (view.name === 'detail' ? view.postId : view.postId))
      : undefined;

  if (mode === 'loading') {
    return (
      <div className="app-shell">
        <div className="bg-atmosphere" aria-hidden="true" />
        <main className="app-main">
          <div className="empty-state">
            <p className="brand">Reel Hook Analyzer</p>
            <p>{statusMsg}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-atmosphere" aria-hidden="true" />
      <main className="app-main">
        <div
          className={`callout ${mode === 'server' ? 'callout-ok' : 'callout-warn'}`}
          style={{ marginBottom: '1rem' }}
        >
          <p>
            保存先: {mode === 'server' ? 'サーバー（JSONファイル）' : 'このブラウザ内のみ'}
            {statusMsg ? ` — ${statusMsg}` : ''}
          </p>
          {saveError && <p>{saveError}</p>}
        </div>

        {view.name === 'list' && (
          <PostList
            posts={data.posts}
            onOpen={(id) => setView({ name: 'detail', postId: id, tab: 'overview' })}
            onNew={() => setView({ name: 'form' })}
            onCompare={() => setView({ name: 'compare' })}
            onData={() => setView({ name: 'data' })}
          />
        )}

        {view.name === 'form' && (
          <PostForm
            initial={view.postId ? data.posts.find((p) => p.id === view.postId) : undefined}
            onSave={upsert}
            onCancel={() =>
              setView(
                view.postId
                  ? { name: 'detail', postId: view.postId, tab: 'overview' }
                  : { name: 'list' },
              )
            }
          />
        )}

        {view.name === 'detail' && current && (
          <PostDetail
            post={current}
            tab={view.tab ?? 'overview'}
            onTab={(tab) => setView({ name: 'detail', postId: current.id, tab })}
            onChange={updatePost}
            onEdit={() => setView({ name: 'form', postId: current.id })}
            onDelete={() => setDeleteConfirmId(current.id)}
            onBack={() => setView({ name: 'list' })}
          />
        )}

        {view.name === 'detail' && !current && (
          <div className="page">
            <div className="empty-state">
              <p>投稿が見つかりません。</p>
              <button type="button" className="btn" onClick={() => setView({ name: 'list' })}>
                一覧へ
              </button>
            </div>
          </div>
        )}

        {view.name === 'compare' && (
          <CompareView
            posts={data.posts}
            onBack={() => setView({ name: 'list' })}
            onOpen={(id) => setView({ name: 'detail', postId: id, tab: 'overview' })}
          />
        )}

        {view.name === 'data' && (
          <DataPanel
            posts={data.posts}
            storageMode={mode === 'server' ? 'server' : 'local'}
            onReplacePosts={(posts) => setData({ version: 1, posts })}
            onClearAll={() => setData({ version: 1, posts: [] })}
            onBack={() => setView({ name: 'list' })}
          />
        )}
      </main>

      {deleteConfirmId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>投稿を削除しますか？</h2>
            <p>この操作は元に戻せません（バックアップがある場合を除く）。</p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removePost(deleteConfirmId)}
              >
                削除する
              </button>
              <button type="button" className="btn" onClick={() => setDeleteConfirmId(null)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
