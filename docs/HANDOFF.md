# 引き継ぎメモ(次のセッション向け)

最終更新:2026-11-17(フェーズ1 完了・main に取り込み済み。フェーズ2・3 のWEBパーツ部分を作成中)

## 1. いまの状況
- SPFx 1.24.1(React 18.3.1、TypeScript 5.8)で作成。Node.js は 26 を使う(`.nvmrc`)
- `src/core` に表示ルール・期間判定・休日判定・検索/絞り込み+テスト(Jest)
- 週間表示の画面(`src/components`)と、プレビュー用のメモリ上のデータ置き場(`src/services/MemoryScheduleService.ts`)
- プレビュー版:`npm run build` → `npm run preview` → `temp/schedule-preview.html`(ダミーデータは `preview/dummyData.js`)
- 日表示(`src/components/DayList.tsx`):週間表示の日付を押すと開く。スマホ幅では最初から日表示
- 上部はツールバー1行(スマホ2行)。検索欄は「名前・現場名」の1つ、部署・区分・自分を一番上は「絞り込み」のポップアップ(`FilterPopover.tsx`)
- 登録フォーム(`src/components/EntryForm.tsx`)。入力チェックは `src/core/entryForm.ts`。プレビューでは「管理者として見る」「保存を失敗させる」を切り替えられる
- 【要確認】ワンタップ登録「在社」の行き先は「本社」(`DEFAULT_QUICK_ACTIONS`)
- WEBパーツ版のデータの読み書き:`src/services/SharePointScheduleService.ts`(SPHttpClient)、変換は `spMapping.ts`、列の内部名は `spConfig.ts`
  - リストの準備・WEBパーツの設定は `docs/LIST_SETUP.md`
  - 「日付のみ」の列:読むときは +12時間して UTC の日付を取る、書くときは UTC の0時(日本のサイト前提)
  - 総務のリスト・会社休日が読めないときは予定表を出したまま、黄色いお知らせ(`warnings`)
  - 版:package.json 0.2.0 / package-solution.json 0.2.0.0
- 開発者の確認待ち:列の内部名(WorkerNameList・総務の2つ・会社休日)、会社休日を既存参照か新規作成か、総務のリストの実際の名前
- まだ:SharePoint の実機での動作確認(リストの準備ができてから)。見た目の洗練(`docs/IMPROVEMENT_PLAN.md`)
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
