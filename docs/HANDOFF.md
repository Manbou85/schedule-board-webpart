# 引き継ぎメモ(次のセッション向け)

最終更新:2026-11-17(フェーズ1:src/core と、プレビュー版の週間表示まで)

## 1. いまの状況
- SPFx 1.24.1(React 18.3.1、TypeScript 5.8)で作成。Node.js は 26 を使う(`.nvmrc`)
- `src/core` に表示ルール・期間判定・休日判定・検索/絞り込み+テスト(Jest)
- 週間表示の画面(`src/components`)と、プレビュー用のメモリ上のデータ置き場(`src/services/MemoryScheduleService.ts`)
- プレビュー版:`npm run build` → `npm run preview` → `temp/schedule-preview.html`(ダミーデータは `preview/dummyData.js`)
- まだ:日表示、登録フォーム、WEBパーツ本体への組み込み(`src/webparts` は雛形のまま)
- 区分のアイコンは自作の線画SVG(`src/components/Icon.tsx`)。区分との対応は `src/components/categoryStyle.ts`

## 1.5 確認用プレビュー(アーティファクト)
| ページ | URL(開発者だけが見られる) |
| --- | --- |
| 週間表示(ダミーデータ) | https://claude.ai/artifact/HW4DyyF3YA9Eg3Ws8QGJH8 |

- 別のセッションから同じURLを更新するときは、Artifact ツールの `url` にこのURLを渡す
- 【要確認】6-2 の「1日休暇」と「単発予定」の順番:デフォルトどおり休暇を優先(`src/core/cellRule.ts` の `DEFAULT_CELL_RULE_OPTIONS`)

## 2. 開発環境のつまずきポイント(クラウド環境)
- コンテナに Node.js 26 が入っていない → nodejs.org から tar.xz を取得し、SHASUMS256 で確認して `/opt/node26` に展開、`export PATH=/opt/node26/bin:$PATH`
- ビルド:`npm ci` → `npm run build`(テスト・lint・.sppkg 作成まで)
- `yo @microsoft/sharepoint`(雛形作成)は root だと動かない → 一般ユーザー(`useradd -m spfx`)で実行し、
  質問には `yes "" |` で既定の答えを流し込む。作ったものをリポジトリにコピーした
- SPFx は ES5 向けにビルドする → `Array.prototype.includes`・`padStart`・`flatMap` などは使わない
- Playwright(スクリーンショット)は最初から入っている Node で動かす(Node 26 の PATH を外す)
- learn.microsoft.com にはつながらない → 公式ドキュメントは GitHub の `SharePoint/sp-dev-docs`(raw.githubusercontent.com)で読む

## 3. 進め方の約束
- 呼び方は「くろさん」。説明は日本語、専門用語にはひとこと説明
- 大きな設計判断は実行前に確認。小さな単位でコミット(日本語)
