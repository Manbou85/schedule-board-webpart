# 引き継ぎメモ(次のセッション向け)

最終更新:2026-11-17(ver 0.2.0。フェーズ1 完了、フェーズ2・3 のWEBパーツ部分を作成済み。開発者の実機確認待ち)

**新しいセッションの Claude は、作業を始める前にこのファイルを最後まで読んでください。**

---

## 0. 新しいセッションの始め方
1. `git fetch origin main` して、main の最新から始める(作業ブランチはセッションごとに指定されたもの)
2. 開発環境を整える(このメモの「5.」):Node.js 26 を入れる → `npm ci` → `npm run build` が通ることを確かめる
3. 開発者に、実機確認の結果と、確認待ちの項目(「2.」)の回答を聞く。そこから続きを決める
4. 画面を変えたら:`npm run build` → `npm run preview` → 確認用プレビュー(「4.」の URL)を上書きする
5. 版を上げるとき:`package.json`・`package-lock.json`(先頭の2か所)・`config/package-solution.json`(2か所)をそろえる。
   `docs/test-checklist.html` の「ver 0.2.0」の例(2か所)も直す
6. 仕上がったら:作業ブランチにプッシュ → 開発者が「PRお願い」と言ったらプルリクエストを作る → 開発者がマージ →
   作業ブランチを main に合わせて(`git merge --ff-only origin/main`)プッシュしておく
7. 毎回の作業の終わりに、「アーティファクト版で確認すること」「WEBパーツで確認が必要なこと」を分けて伝える(CLAUDE.md 3)

## 1. いまの状況(ver 0.2.0)

### できているもの
| 部分 | 場所 | 内容 |
| --- | --- | --- |
| 計算(テスト付き) | `src/core` | 6-2 の表示ルール(`cellRule.ts`)、期間・週・休日の判定、検索・絞り込み、対象者の整理、登録フォームの入力チェック(`entryForm.ts`) |
| 画面 | `src/components` | 週間表示(`WeekGrid.tsx`)、日表示(`DayList.tsx`)、ツールバーと絞り込みのポップアップ(`ScheduleBoard.tsx`・`FilterPopover.tsx`)、登録フォーム(`EntryForm.tsx`)、線画アイコン(`Icon.tsx`)、版の表示 |
| データの読み書き | `src/services` | 約束(`IScheduleDataService.ts`)、プレビュー用(`MemoryScheduleService.ts`)、SharePoint 用(`SharePointScheduleService.ts`・`spMapping.ts`)、列の内部名(`spConfig.ts`) |
| WEBパーツ本体 | `src/webparts/scheduleBoard` | 組み立てと日本語の設定画面 |
| プレビュー | `preview/` | 架空の53名のダミーデータ、1ファイルのHTMLを作るスクリプト。「管理者として見る」「保存を失敗させる」の切り替え付き |
| 手順書 | `docs/` | `LIST_SETUP.md`(リストの作り方・内部名の確かめ方・設定項目)、`DEPLOY.md`(登録・展開・うまくいかないとき)、`test-checklist.html`(実機テスト31項目)、`IMPROVEMENT_PLAN.md`(改修案) |

- テスト:91件(`npm run build` で実行)
- **SharePoint の実機では、まだ一度も動かしていない**(偽物の通信相手でのテストのみ)

## 2. 開発者の確認待ち(回答が来たら直すところ)
| 項目 | 今の仮の値 | 直す場所 |
| --- | --- | --- |
| 行動予定リスト・会社休日リストの作成 | `docs/LIST_SETUP.md` の「1.」「2.」のとおり | (作ってもらうだけ) |
| ワンタップ登録「在社」の行き先 | 本社 | `src/core/entryForm.ts` の `DEFAULT_QUICK_ACTIONS` |

- 確かめ方は `docs/LIST_SETUP.md` の「3.」(列の名前をクリックして URL の `Field=` を見るのがかんたん)
- 確認済み:WorkerNameList の列は計画どおり。「No.」の内部名は `No_x002e_`(2026-11-18)
- 確認済み:休暇情報共有リスト(この名前のまま)。列は Date / AcquisitionTime / Name / Remarks で計画どおり。「Name: No.」は `Name_x003a__x0020_No_x002e_`(使わない)。
  AcquisitionTime の選択肢は 1日/午前/午後/遅刻/早退 で `LEAVE_KIND_LABELS` と一致。Date は「日付のみ」
- 確認済み:休日出勤情報共有リスト(この名前のまま)。列は Date / StartTime / EndTime / WorkPlace / Name で計画どおり。
  StartTime・EndTime は選択肢、Date は「日付のみ」
- 決定:会社休日は社内ポータルに**新しく作る**(既存の休日リストは別サイトのため使わない)。`Lists/CompanyHolidays`
- 実機でエラーが出たら、画面の「くわしい内容(管理者向け)」を共有してもらう(400 は列名、404 はリスト名のまちがいが多い)

## 3. これまでに決めたこと
- 区分のアイコンは**自作の線画SVG**(絵文字は OS で絵柄がばらばらなのでやめた)。Fluent UI のアイコンは外部フォントが必要なので使わない
- 上部は**コンパクトなツールバー**(SharePoint の固定の表示が上にあるため)。検索欄は「名前・現場名」の1つ(どちらかに合えばヒット)。
  部署・区分・「自分を一番上に表示」は「絞り込み」のポップアップ。見出し「行動予定表」は WEBパーツの中に出さない
- スマホ幅では最初に日表示(CLAUDE.md 6-7)
- 6-2【要確認】:総務の「1日」休暇と単発予定が重なったら**休暇を優先**(WEBパーツの設定で切り替え可能)
- 自分たちで作るリストは **URL(`Lists/〜`)で探す**(表示名を「行動予定」に変えても動くように)。既存のリストは名前で探す
- 「日付のみ」の列:読むときは +12時間して UTC の日付、書くときは UTC の0時(日本のサイト前提。テストあり)
- 総務のリスト・会社休日が読めなくても、予定表は出したまま黄色いお知らせ(`warnings`)
- 保存の失敗は、403(権限なし)・404(見つからない)・その他で文言を分ける
- SharePoint とのやり取りは SPHttpClient(SPFx 標準)。PnPjs などのライブラリは足していない
- 見た目の洗練(線と色を減らす・文字と余白の段階をそろえる・書体を SharePoint に合わせる)は**機能ができてから**。
  方向のちがう案を2〜3つプレビューで並べて選んでもらう(`docs/IMPROVEMENT_PLAN.md`)

## 4. 確認用プレビュー(アーティファクト)
| ページ | 作り方 | URL(開発者だけが見られる) |
| --- | --- | --- |
| 行動予定表(ダミーデータ) | `npm run build` → `npm run preview` → `temp/schedule-preview.html` | https://claude.ai/artifact/HW4DyyF3YA9Eg3Ws8QGJH8 |

- 別のセッションから同じURLを更新するときは、Artifact ツールの `url` にこのURLを渡す(渡さないと別のページになる)
- プレビューはブラウザの保存機能を使わない(CLAUDE.md 3)。約220KB

## 5. 開発環境のつまずきポイント(クラウド環境)
- コンテナに Node.js 26 が入っていない → 次のとおり入れる
  ```bash
  cd /tmp && curl -sSO https://nodejs.org/dist/v26.13.1/node-v26.13.1-linux-x64.tar.xz
  curl -sS https://nodejs.org/dist/v26.13.1/SHASUMS256.txt | grep linux-x64.tar.xz | sha256sum -c
  mkdir -p /opt/node26 && tar -xJf node-v26.13.1-linux-x64.tar.xz -C /opt/node26 --strip-components=1
  export PATH=/opt/node26/bin:$PATH
  ```
- ビルド:`npm ci` → `npm run build`(テスト・lint・.sppkg 作成まで)。.sppkg は `sharepoint/solution/schedule-board-webpart.sppkg`(Git には入らない。開発者にはチャットで添付して渡す)
- `yo @microsoft/sharepoint`(雛形作成)は root だと動かない → 一般ユーザー(`useradd -m spfx`)で実行し、質問には `yes "" |` で既定の答えを流し込む
- SPFx は ES5 向けにビルドする → `Array.prototype.includes`・`padStart`・`flatMap` などは使わない。`Error` を継承したクラスは `Object.setPrototypeOf(this, X.prototype)` が必要
- Jest では `@microsoft/sp-http` が読み込めない → テストでは `jest.mock` で差し替える(`SharePointScheduleService.test.ts` 参照)
- `webpack` の CLI は入力待ちで止まる → Node の API で呼ぶ(`preview/build-preview.mjs`)
- Playwright(スクリーンショット)は最初から入っている Node で動かす(Node 26 の PATH を外す)
- learn.microsoft.com にはつながらない → 公式ドキュメントは GitHub の `SharePoint/sp-dev-docs`(raw.githubusercontent.com)で読む

## 6. 開発者について・進め方の約束
- 一人システム管理者。プログラミングは初心者〜初級。説明は日本語で、専門用語にはひとこと説明
- 呼び方は「くろさん」。やさしく元気に、ほめ言葉は少なめで正確さ優先
- 大きな設計判断(ライブラリ追加、構成変更、リストの設計など)は、実行前に理由を説明して確認
- 小さな単位でコミットし、コミットメッセージは日本語
- プルリクエストは、開発者が「PRお願い」と言ったときに作る。マージは開発者がする
- 開発者のPCには Node.js 等を入れない。動作確認は「アーティファクト版(プレビュー)」→「.sppkg をアプリカタログに登録してテストサイトで確認」の2段階
