/**
 * End-to-end checks against the running preview server.
 * Run: npx --yes playwright test --config=playwright.config.ts
 * Or:  npx --yes tsx scripts/e2e-check.ts
 */
import { chromium, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.APP_URL || 'http://127.0.0.1:4173';
const OUT = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('screenshot', file);
  return file;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function fillByLabel(page: Page, labelText: string, value: string) {
  const label = page.locator('label').filter({ hasText: labelText }).first();
  const control = label.locator('input, textarea, select').first();
  await control.fill(value);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 1 brand
  assert(await page.getByText('Reel Hook Analyzer').first().isVisible(), 'brand visible');
  assert(!(await page.getByText('Yohaku').count()), 'no Yohaku brand');
  await shot(page, '01_list_empty');

  // 2 register post A
  await page.getByRole('button', { name: '最初のリールを登録' }).click();
  await fillByLabel(page, 'InstagramリールURL', 'https://www.instagram.com/reel/TEST123/');
  await fillByLabel(page, '投稿タイトル', 'フック検証A');
  await fillByLabel(page, '投稿日時', '2026-03-01T10:00');
  await fillByLabel(page, 'リールの長さ（秒）', '15');
  await fillByLabel(page, '冒頭のフック文', '忙しい会社員向け、夜の準備を10分短縮する方法');
  await fillByLabel(
    page,
    '台本・字幕',
    '0:00 フック\n0:02 問題提示\n0:05 具体策\n0:12 CTA',
  );
  await fillByLabel(page, 'CTA（最後の行動喚起）', '保存して試す');
  await fillByLabel(page, 'テーマ', '時短');
  await fillByLabel(page, '投稿形式', 'トーク');
  await shot(page, '02_register_form');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('heading', { name: 'フック検証A' }).waitFor();
  await shot(page, '03_detail_overview');

  // 3 Instagram open
  const popupPromise = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
  await page.getByRole('button', { name: 'Instagramで開く' }).click();
  const popup = await popupPromise;
  if (popup) {
    assert(popup.url().includes('instagram.com/reel/TEST123'), 'instagram url opened');
    await popup.close();
  } else {
    // Some environments block popups; still require the button to exist and be enabled.
    assert(await page.getByRole('button', { name: 'Instagramで開く' }).isEnabled(), 'ig button');
    console.log('popup blocked; button present');
  }

  // 4 insights
  await page.getByRole('button', { name: 'インサイト' }).click();
  await fillByLabel(page, '再生数 / ビュー', '1000');
  await fillByLabel(page, 'リーチ', '800');
  await fillByLabel(page, '平均再生時間（秒）', '5');
  await fillByLabel(page, 'いいね', '0');
  // leave shares empty
  await page.getByRole('button', { name: 'インサイトを保存' }).click();
  await page.getByText('保存しました').waitFor();
  await page.getByRole('button', { name: '概要' }).click();
  const overview = await page.locator('.page').innerText();
  assert(overview.includes('1,000') || overview.includes('1000'), 'views shown');
  // likes 0 should appear as 0 somewhere if we exposed it - overview kv may not show likes.
  // Check via localStorage null vs 0
  const stored = await page.evaluate(() => localStorage.getItem('reel-hook-analyzer:v1'));
  assert(stored, 'localStorage present');
  const data = JSON.parse(stored!);
  assert(data.posts[0].insights.likes === 0, 'likes is numeric 0');
  assert(data.posts[0].insights.shares === null, 'shares is null not 0');

  // 5 retention
  await page.getByRole('button', { name: '維持率' }).click();
  // clear default second row values and set 4 rows
  const rows = page.locator('.retention-row');
  // ensure 4 rows
  while ((await rows.count()) < 4) {
    await page.getByRole('button', { name: '行を追加' }).click();
  }
  while ((await rows.count()) > 4) {
    await rows.last().getByRole('button', { name: '削除' }).click();
  }
  const values = [
    [0, 100],
    [2, 72],
    [5, 51],
    [10, 34],
  ];
  for (let i = 0; i < 4; i++) {
    const row = rows.nth(i);
    await row.locator('input').nth(0).fill(String(values[i][0]));
    await row.locator('input').nth(1).fill(String(values[i][1]));
  }
  await page.getByRole('button', { name: '維持率を保存' }).click();
  await page.getByText('保存しました').waitFor();
  await page.getByText('最大離脱区間（実測）').waitFor();
  const retText = await page.locator('.chart-wrap').innerText();
  assert(retText.includes('0〜2') || retText.includes('0~2') || /0\s*〜\s*2/.test(retText), 'max drop 0-2');
  assert(retText.includes('28') || retText.includes('28.0'), 'drop ~28pt');
  assert(retText.includes('フック'), 'script mapped');
  assert(!retText.includes('この時刻の台本は未登録') || retText.match(/未登録/g)?.length !== 4, 'some mapping');
  await shot(page, '04_retention_chart');

  // 6 hook
  await page.getByRole('button', { name: 'フック' }).click();
  await page.getByText('参考評価', { exact: true }).first().waitFor();
  const suggestions = page.locator('.suggestions li');
  assert((await suggestions.count()) === 3, '3 suggestions');
  await shot(page, '05_hook_analysis');

  // 7 analysis measured
  await page.getByRole('button', { name: '分析' }).click();
  const analysisText = await page.locator('.page').innerText();
  assert(analysisText.includes('実測'), 'measured drop');
  assert(analysisText.includes('次の投稿で試すこと'), 'next experiments');
  await shot(page, '06_analysis_measured');

  // 8 edit
  await page.getByRole('button', { name: '編集' }).click();
  await fillByLabel(page, '投稿タイトル', 'フック検証A-編集');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('heading', { name: 'フック検証A-編集' }).waitFor();

  // 9 second post without retention
  await page.getByRole('button', { name: '一覧' }).click();
  await page.getByRole('button', { name: '新規登録' }).click();
  await fillByLabel(page, '投稿タイトル', '維持率なしB');
  await fillByLabel(page, 'リールの長さ（秒）', '20');
  await fillByLabel(page, '冒頭のフック文', 'おすすめ');
  await fillByLabel(page, 'テーマ', '雑談');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('heading', { name: '維持率なしB' }).waitFor();
  await page.getByRole('button', { name: 'インサイト' }).click();
  await fillByLabel(page, '再生数 / ビュー', '500');
  await fillByLabel(page, '平均再生時間（秒）', '4');
  await page.getByRole('button', { name: 'インサイトを保存' }).click();
  await page.getByText('保存しました').waitFor();
  // clear retention rows
  await page.getByRole('button', { name: '維持率' }).click();
  while ((await page.locator('.retention-row').count()) > 0) {
    await page.locator('.retention-row').first().getByRole('button', { name: '削除' }).click();
  }
  await page.getByRole('button', { name: '維持率を保存' }).click();
  await page.getByText('保存しました').waitFor();
  await page.getByRole('button', { name: '分析' }).click();
  const estText = await page.locator('.page').innerText();
  assert(estText.includes('推定'), 'estimated wording');
  assert(estText.includes('正確な離脱時刻は表示しません') || estText.includes('断定できません'), 'no definitive time');
  assert(!/離脱が大きい時刻帯は \d+/.test(estText), 'no asserted drop clock');
  await shot(page, '07_analysis_estimated');

  // 10 compare
  await page.getByRole('button', { name: '一覧' }).click();
  await page.getByRole('button', { name: '比較' }).click();
  const checks = page.locator('.check-row input');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByText('最大離脱区間').waitFor();
  await shot(page, '08_compare');

  // 11 data panel
  await page.getByRole('button', { name: '一覧へ' }).click();
  await page.getByRole('button', { name: 'データ' }).click();
  const dataText = await page.locator('.page').innerText();
  assert(dataText.includes('localStorage'), 'storage explained');
  assert(dataText.includes('外部サーバーへは送信しません'), 'no external send');
  await shot(page, '09_data_panel');

  // export download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'JSON出力' }).click(),
  ]);
  assert((await download.suggestedFilename()).endsWith('.json'), 'json export');

  // 12 reload persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('フック検証A-編集').waitFor();
  await page.getByText('維持率なしB').waitFor();
  await shot(page, '10_after_reload');

  // 13 mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('フック検証A-編集').click();
  await page.getByRole('button', { name: '維持率' }).click();
  await page.locator('.retention-svg').waitFor();
  await shot(page, '11_mobile_retention');

  // 14 delete
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.getByRole('button', { name: '概要' }).click();
  await page.locator('header').getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await page.getByRole('heading', { name: '投稿一覧' }).waitFor();
  assert((await page.getByText('フック検証A-編集').count()) === 0, 'deleted');
  assert(await page.getByText('維持率なしB').isVisible(), 'other remains');
  await shot(page, '12_after_delete');

  // import roundtrip quick
  await page.getByRole('button', { name: 'データ' }).click();
  const exportPayload = await page.evaluate(() => localStorage.getItem('reel-hook-analyzer:v1'));
  const tmp = '/tmp/rha-import.json';
  fs.writeFileSync(tmp, exportPayload!);
  await page.setInputFiles('input[type="file"]', tmp);
  await page.getByText('インポート確認').waitFor();
  // duplicate id should be flagged
  await page.getByRole('button', { name: 'インポート実行' }).click();
  await page.getByText('インポート完了').waitFor();
  await shot(page, '13_import_done');

  console.log('E2E checks passed');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
