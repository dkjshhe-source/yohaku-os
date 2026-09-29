# Reel Hook Analyzer

Instagramリールのフックと離脱ポイントを、手入力データから分析する独立Webアプリです。Yohaku OS とは無関係です。

## 技術

- Vite + React + TypeScript
- ブラウザ localStorage（外部サーバー送信なし）
- フック評価はルールベース（外部AI API不要）

## 起動方法

```bash
cd reel-hook-analyzer
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開きます。
`npm run dev` は API サーバー（`:8787`）と Vite（`:5173`）を同時に起動します。投稿データは `data/posts.json` に保存されます。

本番ビルド確認:

```bash
npm run build
npm run preview
```

コアロジック検証:

```bash
npm run verify
```

## 主な機能

- リール登録（URL任意）・編集・削除
- インサイト手入力（未入力と0を区別）
- 視聴維持率の複数点入力・グラフ・最大離脱区間
- フック文の参考評価と改善案（断定しない）
- 投稿一覧・比較・分析結果
- JSON/CSV エクスポート・インポート（上書きは確認後）

## データの扱い

データはこのブラウザ内にのみ保存されます。Instagram API連携・ログイン・スクレイピングはありません。
