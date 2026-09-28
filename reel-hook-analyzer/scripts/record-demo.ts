/**
 * Record a short demo video via Playwright (headful video).
 * Output: /opt/cursor/artifacts/reel_hook_analyzer_demo.webm
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.APP_URL || 'http://127.0.0.1:4173';
const OUT_DIR = '/opt/cursor/artifacts';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function fillByLabel(page: import('playwright').Page, labelText: string, value: string) {
  const label = page.locator('label').filter({ hasText: labelText }).first();
  await label.locator('input, textarea, select').first().fill(value);
}

async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1100, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // reset storage for clean demo
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await pause(800);

  await page.getByRole('button', { name: '最初のリールを登録' }).click();
  await pause(400);
  await fillByLabel(page, 'InstagramリールURL', 'https://www.instagram.com/reel/DEMO123/');
  await fillByLabel(page, '投稿タイトル', 'デモ：習慣化フック');
  await fillByLabel(page, '投稿日時', '2026-03-10T09:30');
  await fillByLabel(page, 'リールの長さ（秒）', '12');
  await fillByLabel(page, '冒頭のフック文', '続かない人へ、習慣化が失敗する最初の3秒');
  await fillByLabel(page, '台本・字幕', '0:00 フック\n0:02 問題\n0:05 解決策\n0:10 CTA');
  await fillByLabel(page, 'CTA（最後の行動喚起）', '保存して今夜試す');
  await fillByLabel(page, 'テーマ', '習慣');
  await fillByLabel(page, '投稿形式', 'トーク');
  await pause(500);
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('heading', { name: 'デモ：習慣化フック' }).waitFor();
  await pause(700);

  await page.getByRole('button', { name: 'インサイト' }).click();
  await fillByLabel(page, '再生数 / ビュー', '2400');
  await fillByLabel(page, 'リーチ', '1900');
  await fillByLabel(page, '平均再生時間（秒）', '4.5');
  await fillByLabel(page, 'いいね', '0');
  await fillByLabel(page, '保存', '86');
  await page.getByRole('button', { name: 'インサイトを保存' }).click();
  await pause(600);

  await page.getByRole('button', { name: '維持率' }).click();
  const rows = page.locator('.retention-row');
  while ((await rows.count()) < 4) await page.getByRole('button', { name: '行を追加' }).click();
  while ((await rows.count()) > 4) await rows.last().getByRole('button', { name: '削除' }).click();
  const values = [
    [0, 100],
    [2, 68],
    [5, 44],
    [10, 31],
  ];
  for (let i = 0; i < 4; i++) {
    await rows.nth(i).locator('input').nth(0).fill(String(values[i][0]));
    await rows.nth(i).locator('input').nth(1).fill(String(values[i][1]));
  }
  await page.getByRole('button', { name: '維持率を保存' }).click();
  await page.getByText('最大離脱区間（実測）').waitFor();
  await page.locator('.chart-wrap').scrollIntoViewIfNeeded();
  await pause(1200);

  await page.getByRole('button', { name: 'フック' }).click();
  await pause(1000);
  await page.getByRole('button', { name: '分析' }).click();
  await page.getByText('離脱について（実測）').waitFor();
  await pause(1200);

  await page.getByRole('button', { name: '一覧' }).click();
  await pause(400);
  await page.getByRole('button', { name: '新規登録' }).click();
  await fillByLabel(page, '投稿タイトル', '維持率未入力の例');
  await fillByLabel(page, 'リールの長さ（秒）', '20');
  await fillByLabel(page, '冒頭のフック文', 'おすすめ');
  await fillByLabel(page, 'テーマ', '雑談');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: 'インサイト' }).click();
  await fillByLabel(page, '再生数 / ビュー', '500');
  await fillByLabel(page, '平均再生時間（秒）', '4');
  await page.getByRole('button', { name: 'インサイトを保存' }).click();
  await page.getByRole('button', { name: '維持率' }).click();
  while ((await page.locator('.retention-row').count()) > 0) {
    await page.locator('.retention-row').first().getByRole('button', { name: '削除' }).click();
  }
  await page.getByRole('button', { name: '維持率を保存' }).click();
  await page.getByRole('button', { name: '分析' }).click();
  await page.getByText('離脱について（推定）').waitFor();
  await pause(1200);

  await page.getByRole('button', { name: '一覧' }).click();
  await page.getByRole('button', { name: '比較' }).click();
  await page.locator('.check-row input').nth(0).check();
  await page.locator('.check-row input').nth(1).check();
  await page.getByText('最大離脱区間').waitFor();
  await pause(1000);
  await page.getByRole('button', { name: '一覧へ' }).click();
  await page.getByRole('button', { name: 'データ' }).click();
  await page.getByText('localStorage').waitFor();
  await pause(1200);

  // mobile peek
  await page.setViewportSize({ width: 390, height: 720 });
  await page.getByRole('button', { name: '一覧へ' }).click();
  await pause(600);
  await page.getByText('デモ：習慣化フック').click();
  await page.getByRole('button', { name: '維持率' }).click();
  await page.locator('.retention-svg').waitFor();
  await pause(1000);

  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(OUT_DIR, 'reel_hook_analyzer_demo.webm');
    fs.renameSync(src, dest);
    console.log('saved', dest);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
