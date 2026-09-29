import { useRef, useState } from 'react';
import type { ReelPost } from '../types';
import {
  applyImport,
  exportCsv,
  exportJson,
  parseImportCsv,
  parseImportJson,
  previewImport,
  type ImportMode,
  type ImportPreview,
} from '../lib/storage';

interface Props {
  posts: ReelPost[];
  storageMode?: 'server' | 'local';
  onReplacePosts: (posts: ReelPost[]) => void;
  onClearAll: () => void;
  onBack: () => void;
}

export function DataPanel({
  posts,
  storageMode = 'local',
  onReplacePosts,
  onClearAll,
  onBack,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('skip');
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setError('');
    setMessage('');
    setPreview(null);
    try {
      const text = await file.text();
      const incoming = file.name.toLowerCase().endsWith('.csv')
        ? parseImportCsv(text)
        : parseImportJson(text);
      setPreview(previewImport(posts, incoming));
      setMode('skip');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'インポートに失敗しました。');
    }
  };

  const confirmImport = () => {
    if (!preview) return;
    const next = applyImport(posts, preview.incoming, mode);
    onReplacePosts(next);
    setMessage(
      `インポート完了: 取込 ${preview.incoming.length} 件（モード: ${
        mode === 'skip' ? '重複IDスキップ' : mode === 'overwrite' ? '重複ID上書き' : '重複は新規ID'
      }）`,
    );
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="brand">Reel Hook Analyzer</p>
          <h1>データ管理</h1>
          <p className="lede">保存・エクスポート・インポート</p>
        </div>
        <button type="button" className="btn" onClick={onBack}>
          一覧へ
        </button>
      </header>

      <section className="section">
        <h2>保存場所とデータの扱い</h2>
        {storageMode === 'server' ? (
          <p>
            データはこのアプリのサーバー（同一プロジェクト内の JSON ファイル）に保存されます。
            ブラウザやURLが変わっても、同じサーバーに繋がっていれば同じデータが見られます。
            Instagram など外部サービスへは送信しません。バックアップ用にエクスポートもできます。
          </p>
        ) : (
          <p>
            いまはサーバーに繋がっていないため、このブラウザ内（localStorage）に保存しています。
            サーバー起動後に再読み込みすると、サーバー保存に切り替わります。
          </p>
        )}
        <p className="muted">登録件数: {posts.length}</p>
      </section>

      <section className="section">
        <h2>エクスポート</h2>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              download(
                exportJson({ version: 1, posts }),
                `reel-hook-analyzer-${dateStamp()}.json`,
                'application/json',
              )
            }
          >
            JSON出力
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(
                exportCsv({ version: 1, posts }),
                `reel-hook-analyzer-${dateStamp()}.csv`,
                'text/csv;charset=utf-8',
              )
            }
          >
            CSV出力
          </button>
        </div>
      </section>

      <section className="section">
        <h2>インポート</h2>
        <p className="hint">
          既存データは自動では上書き・削除しません。重複がある場合は確認のうえ取り込み方法を選べます。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {error && <div className="callout callout-error">{error}</div>}
        {message && <div className="callout callout-ok">{message}</div>}

        {preview && (
          <div className="import-preview">
            <h3>インポート確認</h3>
            <ul>
              <li>読み込み件数: {preview.incoming.length}</li>
              <li>新規IDとして追加できる件数（重複除外）: {preview.newCount}</li>
              <li>既存と同じID: {preview.duplicateIds.length} 件</li>
              <li>タイトルが既存と似ている（参考）: {preview.duplicateTitles.length} 件</li>
            </ul>
            {preview.duplicateIds.length > 0 && (
              <div className="callout callout-warn">
                同じIDの投稿があります。下の方法を選んでから実行してください。勝手には上書きしません。
              </div>
            )}
            <label>
              重複IDの扱い
              <select value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
                <option value="skip">スキップ（既存を維持）</option>
                <option value="overwrite">既存を上書き</option>
                <option value="asNew">新しいIDで追加</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={confirmImport}>
                インポート実行
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>全件削除</h2>
        {!confirmClear ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)}>
            全データを削除…
          </button>
        ) : (
          <div className="callout callout-error">
            <p>本当にすべての投稿データを削除しますか？この操作は元に戻せません。</p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                  setMessage('すべてのデータを削除しました。');
                }}
              >
                削除する
              </button>
              <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
                やめる
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
