import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'posts.json');
const PORT = Number(process.env.PORT || 8787);

type AppData = { version: 1; posts: unknown[] };

function emptyData(): AppData {
  return { version: 1, posts: [] };
}

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData(), null, 2), 'utf8');
  }
}

function readData(): AppData {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as AppData;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.posts)) return emptyData();
    return parsed;
  } catch {
    return emptyData();
  }
}

function writeData(data: AppData): void {
  ensureStore();
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: 'server-json', file: DATA_FILE });
});

app.get('/api/data', (_req, res) => {
  res.json(readData());
});

app.put('/api/data', (req, res) => {
  const body = req.body as AppData;
  if (!body || body.version !== 1 || !Array.isArray(body.posts)) {
    res.status(400).json({ error: 'invalid payload: expect { version: 1, posts: [] }' });
    return;
  }
  writeData({ version: 1, posts: body.posts });
  res.json(readData());
});

app.listen(PORT, '0.0.0.0', () => {
  ensureStore();
  console.log(`Reel Hook Analyzer API on http://0.0.0.0:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
