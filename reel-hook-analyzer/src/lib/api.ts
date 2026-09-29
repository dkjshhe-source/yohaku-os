import type { AppData } from '../types';
import { loadData as loadLocal, saveData as saveLocal } from './storage';

export type StorageMode = 'server' | 'local' | 'loading' | 'error';

export async function fetchServerData(): Promise<AppData> {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error(`サーバー応答エラー (${res.status})`);
  const data = (await res.json()) as AppData;
  if (!data || data.version !== 1 || !Array.isArray(data.posts)) {
    throw new Error('サーバーのデータ形式が不正です');
  }
  return data;
}

export async function saveServerData(data: AppData): Promise<AppData> {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`サーバー保存に失敗しました (${res.status})`);
  return (await res.json()) as AppData;
}

export async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}

/** Load from server; if server empty and local has posts, migrate once. */
export async function bootstrapData(): Promise<{
  data: AppData;
  mode: 'server' | 'local';
  migrated: boolean;
  error?: string;
}> {
  const online = await checkServer();
  if (!online) {
    return {
      data: loadLocal(),
      mode: 'local',
      migrated: false,
      error: 'サーバーに接続できません。一時的にこのブラウザ内保存を使います。',
    };
  }

  let serverData = await fetchServerData();
  const local = loadLocal();
  let migrated = false;

  if (serverData.posts.length === 0 && local.posts.length > 0) {
    serverData = await saveServerData(local);
    migrated = true;
  }

  // keep a local cache mirror
  saveLocal(serverData);
  return { data: serverData, mode: 'server', migrated };
}
