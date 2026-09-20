# 引継ぎメモ

## 次にやること — 公開品質の3件（2026-09-20 夜・未着手、方針のみ確定）

ハッカソンは終了。本番は https://ebiharadev.org で公開中（下記「9月末までの本番公開」）。ユーザーの選択で、製品側の残りは次の3件をこの順で進める。**コードはまだ触っていない**（下調べのみ）。製品を変えたら `npm run deploy` は本番を出したセッションの手順（deployment.md）に従うこと。

### 1. F-01 / F-02 — 真相の一文がクリアしない

- 事実: 「引数の並びを鍵にする。ただし int か str が1個だけなら値自体が鍵。typed=Trueでは型も区別する」を Jev が読むと `types` が 0.36〜0.39。`predictLru` は 0.4 未満を false と読むが、判定強度 `|r-0.5|*2` が 0.22〜0.28 で 0.55 未満なので L6 が「読み取り未確定」になり、`reviewCheck` でクリアできない。ボット（理解者 6/7）と `subject:check`（truth-passes-all ✗）が同じ点を指した
- 方針（コード側、小さい）: `src/lib/lru-select.ts` の `predictLru` で **singleFast ≥ 0.6 かつ types < 0.6 のとき types を false と確定し、`relevant` から外す**。理由: 「1個だけ特例」を述べた仮説は「2個なら 1 と 1.0 は同じ」を含意するので、一般の型条件を述べていないと読んでよい。両方はっきり述べた文（types ≥ 0.6）は従来どおり L6 で食い違う
- 方針（基準文側、F-02）: `src/subject/lru.ts` `LRU_AXES.types.criteria.false` に「1 と 1.0（int と float）は同じ呼び出しだと明言する、または typed=False なら型は関係ないと言う文は false」を足す。報告者の期待「typed=Falseなら1と1.0は同じ呼び出しとして記憶を返す」が L5/L6 とも undetermined になっている（types が中間帯）
- 検証: `src/lib/lru-select.test.ts` に「types 0.38 でも singleFast 0.98 なら全7例一致」を足す。`npm run eval:lru`（直近 11/14、下げない）、`npm run harness:stress`（理解者がクリア、報告者が L5/L6 を割る）、`npm run subject:check`（truth-passes-all / expectation-splits-pair が ○）、`npm test`

### 2. F-03 — 相棒の台詞の漏れ（`src/subject/lru.ts`）

- L2「…呼び出し方が違うと、もう一度計算しました」→ 疑問形に。案: 「計算に使う値は同じ。`f(1)` と `f(1, 0)` で違うのは何でしょう？」
- L4「順番が変わると別扱い。PRの追記が…」→ 案: 「同じ名前、同じ値。それでも別扱いになりました。2つの呼び出しで違うところは1つだけです」
- L7「設定を変えると、2個の引数でも型を区別します」→ 「2個の引数でも」が L5/L6 の対比を持ち込む。案: 「設定を1つ変えただけで、L6 と結果が変わりました。この設定は、あなたの説明のどこに入りますか？」
- 台詞の文字列を参照するテストは無い（`src` / `tests` を検索済み。`.companion` は表示クラスだけ）。直したら `npm run lint:jev -- check src/subject/lru.ts` で companion-does-not-leak が消えることを確認し、`docs/eval/jev-lint-<date>.md` に追記

### 3. H-08 — 未提示事例（holdout）で締める

- 事例: **`f(1.0)` のあとに `f(True)` → 記憶を返す**（lru-cache.md §3 補助表で実測済み。`(True,) == (1.0,)` のため）。features は types false / singleFast false なので、真相の仮説は「記憶」と予想し、「型が違えば常に別」の仮説は外す。転移の測定になる
- データ: `src/subject/lru.ts` に `LRU_HOLDOUT`（id "H1"、calls、actual、observation、evidence）。`scripts/verify-lru.py` の cases に `("H1", [((1.0,), {}), ((True,), {})], False, "remembered")` を足し、`scripts/verify-lru.mts` の照合ループにも含める（結果は実行で得る、の不可侵ルール）
- UI: `src/app/review-panel.tsx` の receipt で `receipt.cleared` のときだけ「最後にひとつ、見ていない事例」を出す。呼び出しの組 → 記憶 / 計算 / エラー の3ボタン → 押してから実測と observation を表示。クライアント側だけで完結（LRU_CASES と同様に束に入る）。保存はしない。`page.tsx` は他セッションが触るので避ける
- Playwright: `tests/e2e` の UI 回帰に「クリア後に holdout が出て、予想を押すと実測が出る」を1本

### その他

- docs は 2026-09-20 夜に更新済み: `journey.md`（冒頭注記、§0b 導入案 B、§4/§7 の F-01 注記、§9 に F-01/F-03/H-08/案B、§10 証拠の台帳）、`roadmap.md`（フェーズ R 公開品質、全体像に P/H/R、J/S3 の状態）、`concept.md` §12 末尾の追記（クリア条件は F-01 を直すまで成立していない。旧「12. 公開構成」は「13.」に改番、内容は Tunnel 時代のまま → deployment.md が正）
- `/statusline` が誤って打たれ、statusline-setup エージェントが起動したが PS1 が無く**何も変更していない**。設定したければ表示内容を指定して再実行
- 上の3件はすべて未コミット・未デプロイ。ハーネス整備分も未コミット（下記）

## ハーネス整備（2026-09-20）

体験と題材を批判的に測る道具を入れた。全体は [harness.md](harness.md)、タスクは backlog H / F 節。製品コードは触っていない（`package.json` の scripts 追加、`.gitignore` にリントのキャッシュ、`AGENTS.md` にハーネス節のみ）。

- 実体: `scripts/harness/`（固定戦略ボット・帳面レポート・jev-lint ラッパー）、`scripts/subject/`（mine / rank / check / specs）、`rules/`（jev-lint ルール4本＋commit ルールの写し、fixtures と baseline 付き）、`.jev-lint.yaml`、スキル `.claude/skills/{subject-forge,journey-check}` と外部3本（`jev-lint`、`game-design-reality-check`、`stress-testing-game-concepts`。`skills` CLI で `.agents/skills/` に入れ `.claude/skills/` へ symlink、`skills-lock.json` が台帳）
- 初回結果は `docs/eval/`（stress / notebook / subject-check / jev-lint、すべて 2026-09-20）。**製品側の finding は F-01〜F-05**。要点: 真相の一文が `types` 軸 0.36〜0.39 のせいで L6「解釈の確認」になりクリアしない（ボットと題材検査が同じ点を指した）。相棒の台詞 L4/L7 が仕組みを示唆。体験主張に観測がない節が journey 7・concept 5
- 未実行: `subject:mine` / `subject:rank` は構文確認のみで実 API では回していない（GitHub 検索の疎通は確認済み）。`subject:check` は lru 固定の結線
- Windows の注意: jev-lint は必ず `npm run lint:jev -- …` 経由（ラッパーが ast-grep.exe を渡す）。Markdown ルールの expect.yml と `eval --replay` のラベル突き合わせは効かない（harness.md §5）
- 未コミット。他セッションの Workers 移行差分と混在しているので、切り方は指示を待つ

## 既存サブドメインの一時停止（2026-09-20・完了）

- ユーザー提供のAccess編集用カスタムAPIトークンで停止設定を完了。Wrangler OAuthでは403、`login --scopes-list` にAccess編集scopeがなく、別トークンが必要だった。秘密値はリポジトリに保存していない。チャットに共有されたトークンは作業後にユーザーが失効させること。
- ユーザー依頼の対象は `amidakuji.ebiharadev.org` と `dev.ebiharadev.org`。仮説クエスト（apex）は停止対象外で、HTTPS 200を再確認。
- `dev` は停止中のCloudflare Tunnel `colab-ssh` のremote configから `ssh://localhost:22` のhostname ingressを削除済み。version 3を読戻し確認し、ingressは `http_status:404` のみ。DNS・既存Access・WARP設定は保持したため、匿名HTTPSではAccessログイン画面が残るがSSHへの経路は除去済み。
- **あみだくじはAccess全員拒否で公開停止済み。** アプリ `001678a3-28eb-4c27-b013-c81e55701f8d`（Paused amidakuji - 2026-09-20）、policy `1998e8f9-5a96-4b38-9c00-79222ae316df` はdeny/everyoneのみ。独自ドメイン・production pages.dev・`*.amidakuji.pages.dev` の3宛先を設定し読戻し確認。
- Playwrightの新規匿名contextで独自ドメイン・pages.dev・既存deployment全3件（ec9c589e/c246cee1/c2db38da）の計5ホストを検証。各 `/`・`/favicon.ico`・`/api/` がAccessへ302、ブラウザもAccessログイン画面へ遷移。作成直後は反映待ちの200があったため再検証した。ソース・Pagesプロジェクト・デプロイ履歴は保持。再公開は明示依頼があるまで行わない。

## 9月末までの本番公開（2026-09-20・最新）

- **https://ebiharadev.org で公開済み**。Worker `hypothesis-quest`、version `1027fad9-af84-4f0e-a956-cb42e1b285a6`。専用D1 `37a3842d-0f56-4973-8a56-65e2d61c4bfb` を作成・migration適用し、Jev/OllamaをSecrets登録済み。旧ローカル入力はアップロードしていない。
- Custom Domainは既存DNSとの競合100117で失敗したため、既存DNSを削除せず **Worker Route `ebiharadev.org/*`** で公開。以前はCloudflareの初期ページ。workers.dev/preview URLsは無効、Routeのfail-openもfalseを確認。
- **公開期限は日本時間2026年10月1日0時**（9月30日いっぱい）。`custom-worker.ts` の外側ゲートで期限後は画面・静的ファイル・APIを410にする。`assets.run_worker_first=true`、静的JS/CSSはゲート後ASSETSから配信。no-storeで期限後のキャッシュ配信を防ぐ。期限欠落・不正も閉じる。Worker/DNS/D1/Secretsは自動削除しない。
- 入力読み取り60回/分、その他POST API20回/分のIP別制限。拠点単位であり厳密な課金上限ではない。超過429、制限機能障害503。匿名公開。期限延長はユーザーの明示依頼が必要。
- 検証: 単体31件・型チェック・Workerビルド成功。期限後設定のローカルWorkerで画面/実在JS/APIすべて410を確認。期限中WorkerのPlaywright UI12件、本番HTTPSに対する実Jev/LLM4件が通過（質問→ヒント→提出→復元、別セッション分離）。本番bindingの期限・Secrets登録も確認済み。
- `AGENTS.md` にHANDOFF/関連docs/公開時deployment.md必読を追記。`CLAUDE.md` を新設し `@AGENTS.md` で参照。今後の運用は `docs/deployment.md` を読む。今回までのWorkers関連変更は未コミット。

## Workers構成への移行（2026-09-20・最新）

- 検証: 単体28件、型チェック、OpenNext Workerビルド通過。Workersローカル8787でPlaywright UI12件・実Jev/LLM4件通過。実質問→ヒント→提出→再読込と他セッション非公開を確認。旧ボタン名を使っていたliveテストは現UIへ修正し再実行。成果物1208ファイルの秘密値混入は0件。元のNext dev（3001）でもD1読込200。
- 公開先設定を `ebiharadev.org` のCloudflare Workersへ変更。OpenNext 1.20.6 / Wrangler 4.135.0。既存Next.js 16.3.5は維持。本番D1作成・Secrets登録・DNS切替・デプロイは未実行。`wrangler.jsonc` のD1 UUIDは仮値で、deployスクリプトは未設定時に停止する。
- `src/lib/notebook-d1.ts` に非同期D1リポジトリ。APIは保存・読込をawait。リクエストごとのD1 session（first-primary）、ヒントのatomic JSON更新、提出のbatch/重複防止、同時異内容提出の409を追加。SQLiteの本番依存を除去。旧 `data/` は保持・未移行。
- `.env.local` を `.dev.vars` へ移行（Git対象外）。OpenNextは.envファイルをWorkerへ埋め込むため。`server-env.ts` でbindingから読む。単体テスト・評価スクリプトはprocess.envへfallback。生成・検問のロジック自体は変更していない。
- `npm run dev` はローカルD1 migration後に3002。`npm run preview` はWorkerビルド後8787。`npm start` はD1 bindingがないので使わない。従来のTunnel手順は `docs/deployment.md` のWorkers手順へ置換。
- 公開前にCloudflareアカウント・apexの既存DNS・D1 UUID・Secretsと、公開アクセス/レート制限/保持期間を確認する。匿名AI利用に対する制限は未実装。
- 型はWorkersのbindingだけをimport。Wrangler生成のruntime全体型を混ぜるとNext.js/DOMのRequest.json型と競合するため使用しない。

## 元フォルダへの統合（2026-09-20）

- 統合後の検証: 単体28/28、TypeScript、元フォルダの3001に対するPlaywright UI 12/12通過。
- `jev-hathon-3002` のLLM回答・ヒント・最終提出・最新UI調整を `C:/Users/ABC/pj/jev-hathon` に統合。今後の作業先は元フォルダとする。以下の「3001側は変更していない」「このツリーで行う」は分離開発時の記録。
- 環境変数・SQLite DB・依存フォルダはコピーせず、各フォルダのものを維持。元フォルダの起動中サーバー（3001）にも新実装が反映される。3002の別worktreeも残している。
- `npm run dev` の既定は統合元と同じ3002。別worktreeの3002が起動中なら、元フォルダでは `node node_modules/next/dist/bin/next dev --port 3001` を使う。
- Cookie名は3002版のものを引き継ぐため、旧3001の帳面はDBに残るが新UIのセッションからは表示されない。DB・履歴の移行は行っていない。

## UI パス（2026-09-20・3002）

画面の構造だけを変えた。判定・API・データは触っていない。単体28件・Playwright UI 12件・tsc 通過。

- 鏡（こう読んでいます）を入力欄の直下、送信ボタンの上に移動。送信前に読み取りが見える順序にした
- 鏡には条件の軸だけを映す。条件がひとつも映らないときだけ「ルールを述べている」の棒を出し、鏡を空にしない
- 質問回答では LLM の語りと「理由も知りたい」を2枚の事例の**下**に移動。まず事例を比べ、語りは後
- デスクトップ（801px〜）は右カラム（入力・帳面）を sticky にし、長い回答を読んでも入力欄が見える。カラム内は縦スクロール
- モバイル（〜800px）は順序を 入力 → 観察 → 帳面 → 未確認 に変更（`display: contents` + `order`）。送信後は結果カードへスクロール（`revealResult`、幅 800px 以下のみ）
- 「仮説なしで次の事例」「観察を区切ってレビュー」を鏡から切り離し、ヘルプの下の secondary-actions にまとめた
- 帳面の保存・送信の注意書きは折りたたみ「保存と送信について」に。帳面上部の「レビュー提出・保存した回答を見る」は下部の「提出したレビューと回答を見る」に
- 鏡の表示閾値を 0.20 → 0.35（`MIRROR_MIN`）。型だけの文で「1個だけの特例」が 0.2 台で薄く映り、触れていない軸の名前が漏れていたため
- 見送ったもの: ヘッダーの「3002 · LLM回答・レビュー提出版」タグ（開発用表示のため据え置き）

## 3002並行版：LLM回答・最終提出（最新）

- ユーザー依頼により、3001を維持したまま `C:/Users/ABC/pj/jev-hathon-3002` / `llm-3002` worktreeで実装。元の未コミット実装をコピーして開始し、3001側のソースは変更していない。3002は独立した依存・ビルド出力・DB・Cookieを使う。`npm run dev` は3002。
- `narration.ts`: Ollama Cloudで日本語回答（実測から既定はgemma4:31b）。通常質問には解き方を渡さず、明示的ヒントでは対応する観察・コード断片を渡す。Jev Noulの根拠照合・個人採点チェック・通常質問のみネタバレチェックをバッチ化。リスク0.30以上／不正応答／通信失敗は未検問文を返さず定型文。表示に生成／定型を明記。
- `/api/predict` の質問返答に生成文を追加し帳面へ保存。`/api/explain` は同じセッションの質問IDからのみヒントを作り保存する。外部から渡された根拠は信用しない。
- `/api/review`: 最後の仮説・判断・レビューを受け取り、仮説だけをJevに読み取らせ、コードで7事例と照合。その後、提出文・限定した帳面要約・実測をLLMへ渡し解説を検問。7件すべてmatchのみクリア。読み取り失敗は未確定として保存し、成功扱いしない。理解度やPRのマージ可否は採点しない。
- SQLiteのsubmissionsに提出スナップショットと回答を保存。提出IDの再送は保存済み回答を返す。別セッションには渡さない。画面から履歴を復元でき、通信失敗時も入力を保持。提出はアプリ内のみでGitHubへの送信なし。
- `review-panel.tsx` / `narration-view.tsx` にUIを分離。提出内容・回答・照合根拠を区別し、PC/スマホで横あふれを検証する。
- 実測で生成本文が英語になった旧GLMプローブの知見を踏まえ、今回はgemma4を採用。質問／ヒント／提出解説はおおむね1〜2秒。プロバイダー障害・検問不合格は定型に落ちる。
- 未完: 曖昧文のLLM分割（U-05）、任意ケース生成（T-70）、保持期間・削除UI・公開向けレート制限。3001とは同期しないため、今後の変更はこのツリーで行うこと。
- 検証結果: 単体28/28、本番ビルド・TypeScript通過、Playwright16/16（実API4件）。実LLMの質問→理由ヒント→最終提出→再読み込み復元、再送の重複防止、別セッションの提出／ヒント分離、不正入力・別Originの拒否を確認。PC／スマホと実LLM回答のスクリーンショット確認済み。3001は元のPID6572、3002はPID8524で継続起動。

## 質問と帳面の実装（2026-09-20・ウミガメ化の第1段階）

- ユーザー確認により、最新の `decisions.md` / concept §12を優先。journey §2bの入力中LLMの声は保留。今回は質問対応と帳面を実装し、生成解説・曖昧文のLLM分割はまだ実装していない。
- `/api/read` は6軸Noulに、入力種別と質問の話題のChoiceを同じリクエストで追加。実結果・帳面はJevに渡さない。種別が曖昧なら本人が質問／仮説を選ぶ。Choiceの型・選択肢・確率分布を検証する。
- 質問は題材データ `src/subject/lru-questions.ts` の比較に対応付ける。型の質問はL5/L6の実結果から「場合による」と計算し2枚表示。否定形に裸の「はい」を返さず、**読み替えた問いを併記**する。これは限定した比較への回答であり、任意の自然文質問の完全な回答器ではない。
- `f(True)` 等の未検証の質問は「まだ答えられません」。無関係な話の「関係ない」と区別。答えの割れは多数決で丸めない。core属性のある質問にだけ固定文で反応する。
- `node:sqlite`、`data/notebook.sqlite`。送信して回答を得た入力・種別・読み取り・返答・提示事例・時刻を保存。下書きや種別確認待ちは保存しない。帳面本体は外部送信しないが、入力文は読み取りのためJevへ送信する。
- ブラウザのHttpOnly/SameSite=StrictセッションCookieで帳面を分離。再読込後に帳面・記録された提示事例・最後の仮説を復元。現時点はDBの自動削除なし／明示的新規セッション・削除UIなし（D-08は運用決定が残る）。SQLiteファイルはGit対象外。
- `npm run eval:questions`: 実Jevの9入力（否定形・未知の具体例・無関係文・仮説含む）は9/9期待した経路。220〜700ms程度。一般精度・曖昧文の網羅性は保証しない。
- 検証: 単体23件、Playwright13件（実Jev3件）通過。SQLite再接続、セッション分離、復元→質問→仮説→レビューを確認。CPython 3.12.3の8実結果一致、本番ビルド通過。PC/スマホの比較画面と帳面のスクリーンショット確認済み。
- 次: U-05のLLM分割、U-13の帳面との照合、U-20〜22の提出・検問付き解説、共通スキーマ。現在のレビューは下書きのみで、生成解説・クリア判定は未実装。

## 題材2の実装（2026-09-20・最新）

- `/` をlru_cacheに変更。注文APIは `/orders` に残した。更新された `journey.md` §0に合わせ、bpo-39554の期待を背景にした **演習用の架空PR** をメンテナとしてレビューする導入を実装。架空であることを明記し、実在のPR番号を付けない。最初の試作に使った実在のドキュメントPR #9298とは別。
- L1を観察してから自由文の仮説を書く。L1〜L7で予想と実測を比較し、L5/L6は並べて表示できる。L8は独立した追加の論点として開く。事例→イシュー・CPython 3.12.3のコード行へリンク。
- `/api/read` と入力中の鏡を追加。400ms、4文字以上、IME中は停止、AbortController＋世代番号で古い応答を捨てる。p>=0.20の軸だけ表示し、未入力の軸から答えを漏らさない。数値は点数として表示しない。
- 7事例を見終えた場合だけでなく、途中で観察を区切ってレビュー下書きを書ける。外部投稿なし。実際のメンテナの返答は折り畳み内で比較する。見ただけで「説明できた」とは表示しない。
- 読み取りはBを継続。`src/subject/lru.ts` はルールの有無・書き方・順番・常時の型区別・単一引数の特例・typed設定の6軸。`probe-lru-axes.mjs` の5概念軸は実験資料として保持。言及だけから例外の内容を補わないため、具体的な主張を読む軸に分けた。
- `npm run verify:lru`: WSL CPython 3.12.3で各カードを新しいキャッシュから実行し、**画面の8件の実結果と一致**。`scripts/verify-lru.py` は直接実行も可能。
- `npm run eval:lru`: 題材2の14文の期待選択を測る。直近は **11/14**。型まで同じという仮説までの主要な階段は動くが、順番を無視する否定形や複合例外は別の事例／解釈確認になる。これは軸の一般正答率ではない。不一致があれば終了コード1。J-01/J-02の全体評価、B/C比較は未完。
- 検証: `npm test` 18/18、Playwright 10/10（うち実Jev2件）、本番ビルド通過。題材2の導入・分岐・IME・古い応答・障害時・レビュー下書きと、実JevのL2→L5分岐を確認。PC／スマホのスクリーンショットを確認。
- 未実装: 共通題材スキーマへの全面統合、T-31の手動解釈確定、T-67の報告者期待パネル、T-68の履歴ごとのコード強調、T-69の生成する声、T-70のユーザー作成事例。今回の相棒文は固定。`journey.md` の新しい生成LLM構想を実装済みとは扱わない。

## 続きの実装（2026-09-20）

- Noul 4軸を維持し、仮説だけの構造化stateと短い英語の質問＋true/falseの基準に変更。拒否節でのID言及を再利用条件に数えず、ID一致から再送を補完しないよう定義した。公式仕様どおり `answers.*.noul` を読み、不正応答は失敗にする。
- 単なる日本語質問の短縮では混同が残った。基準を追加した実測では「同じ商品は重複して登録しない」→ C3、「同じ依頼IDなら、登録は1件のまま」→ C4。主要な2分岐を確認。
- `npm run eval:jev` で6仮説の読み取り・全事例の予想・次の事例を再測定できる（実APIを6回呼ぶ）。再送＋拒否の仮説はC5だが判定強度が低く「解釈の確認」。単なる「再送では増やさない」は拒否節がないためC4が先に出る。
- 曖昧な軸の全組合せで予想が変わる場合は「決まらない」。結果に関わる軸の確率から算出したアプリ独自の判定強度が0.55未満なら、事例選択・履歴も含めて反証と断定しない。NoulにAPI提供のconfidenceはない。
- 全事例表示は仮説の正しさを保証しないため、終了文を「6事例を見終えました」に修正。再開ボタン、終了後のCtrl+Enter抑止、障害時も最後の実結果を見て終了できる導線を追加。
- `npm test` は14件（6事例の実結果＋判定・応答検証）。Playwrightは `npm run test:e2e`（API応答を固定した画面回帰）、`npm run test:e2e:live`（実Jevの2分岐）。初回は `npx playwright install chromium`。
- 注文APIの動作確認台本: [demo-orders.md](demo-orders.md)。本番題材のlru_cache載せ替えは [backlog.md](backlog.md) のT-60以降として残る。
- 限界: 複数条件はANDとして扱う。任意の否定・OR・例外・数量条件を扱う汎用の仮説解釈器ではない。未評価の言い換えを含む一般精度は未保証。

再開後の検証: 単体14/14、Playwright 5/5（画面回帰4件＋実Jev1件）、TypeScript・本番ビルドを通過。PC 1440px／スマホ390pxのスクリーンショットを確認し、横あふれなし。

## 以下は再開前の記録

2026-09-20 ハッカソン当日、残り約1h時点で中断。

## いまの状態

- `npm run dev` で画面が動く。`npm test` は 6/6 通過。`npx tsc --noEmit` と `npm run build` はエラーなし
- **未コミット。** `git status` で docs 再編＋実装一式が出る
- Jev キーは `.env.local`（gitignore 済み）
- 公開は `npm start` + Cloudflare Tunnel。手順は [deployment.md](deployment.md)

## 動いていること

- 画面1枚（仮説入力 / 事例比較 / 履歴 / 調べたこと / 未確認論点 / 段階ヒント / 終了画面）
- `/api/predict` → Jev → 照合 → 事例選択（反証 → 決まらない → 未提示 → 終了）の一巡
- Jev 失敗時のフォールバック（エラー表示＋「予想なしで次の事例を開く」）
- 題材コード `src/subject/orders.ts` と、6事例の実結果がそれと一致する検証 `orders.test.ts`

## 動いていないこと（最重要）

**Jev の読み取りがまだ安定していない。** 2通りの設計を試し、どちらも決め手に欠ける。

### 設計A: 事例ごとに Choice（「仮説に従うと最後の操作の結果は？」4択）

git 履歴には残っていない（未コミットのまま書き換えたため）。`docs/concept.md §5` の「当日のチューニングで学んだこと」に要点あり。

| 仮説 | 期待 | 結果 |
| --- | --- | --- |
| 同じ商品は重複して登録しない | C3 で反証 | C3 を「登録される」と読み一致扱い。C4 が低確信度で反証に |
| 同じ依頼IDなら1件のまま | C4 で反証 | **C4 反証 ✓（確信度 0.43〜0.54）** |
| 再送では登録を増やさない（＋中身違いは拒否） | C5 で反証 | C5 を「登録される」と読み一致扱い |

原因: 状況文の含意（「意図して2件目」「IDを作り直した」）と冪等キーの一般知識に引っ張られ、仮説を機械的に適用できない。
「Idempotency-Key」の語を消し、「仮説に出てこない要素は影響しない」と明示しても改善せず。

### 設計B: 仮説文だけを Noul 4軸で読む（現在のコード）

`src/lib/jev.ts` が仮説文だけを Jev に渡し、「商品が同じ／依頼IDが同じ／再送／中身違いは拒否」を条件に挙げているかを Noul で取る。当てはめは `src/lib/select.ts`。

| 仮説 | 読み取り（yes 確率） | 結果 |
| --- | --- | --- |
| 同じ商品は重複して登録しない | sameContent **0.26** sameKey 0.49 retry 0.46 | 商品を条件と読めていない。C4 が偶然反証に |
| 同じ依頼IDなら、登録は1件のまま | sameKey **0.75** retry 0.59 | 読めている。C4 が「決まらない」で提示（拒否節 0.39 が unclear 帯） |
| 再送では登録を増やさない | retry **0.31** | 再送を条件と読めていない。全事例「決まらない」 |

原因の推測: Noul の問いが長く、「〜を条件として挙げているか」という否定形・二重構造が読みにくい。

## 次に試すこと（順番）

1. **Noul の問いを短くする。** 例:「この仮説は商品について言っているか」「依頼IDについて言っているか」「再送について言っているか」。閾値は `select.ts` の `NAMED=0.6 / UNCLEAR=0.4`
2. それでも弱ければ **Choice 1問**「この仮説が『同じ』と見なす基準はどれか」`{商品, 依頼ID, 再送, 読めない}` にし、選ばれた軸だけを条件にする。1仮説1リクエストは維持
3. デモ台本は、現状でも動く仮説 **「同じ依頼IDなら、登録は1件のまま」→ C4** を軸に組む。2本目は結果を見て選ぶ
4. 動作確認コマンド:
   ```
   curl -s -X POST http://localhost:3000/api/predict -H "Content-Type: application/json" \
     -d '{"hypothesis":"同じ依頼IDなら、登録は1件のまま","shown":[]}'
   ```

## Jev 適合性の方向性（2026-09-20 夕方）

`npm run eval:jev` の実測: 設計B（英語の問い＋基準文）で典型6文は軸 0.9 台、「よくわからない」は全軸 0.0 台、応答 200〜640ms。
効いたのは日本語の問いの短縮ではなく、**英語の問い＋各軸の true/false 基準文**。問題は「読めない」から「6文以外でも読めるか」に移った。

方向性（タスクは [backlog.md](backlog.md) の J）:

1. **評価セット**が先。言い換え・否定・OR・例外・英語・誤字・雑談・題材2の階段で 20〜30 文、軸ごとの正解ラベル。これがないとどの変更も「6文で動いた」以上のことが言えない
2. **ライブ読み取り**（入力中に4軸の棒）。応答速度的に可能。B/C どちらでも棒に出すのは読み取りベクトルなので設計の勝敗に依存しない。P3 の代わりになる
3. **設計C 含意判定**を並走。事例ごとの帰結文3本を固定データにし、Noul「仮説からこの帰結は導けるか」18問/1リクエスト。言い回し・例外・OR に強いはずだが「沈黙」と「否定」の区別が弱い。評価セットで B と比較して採用を決める
4. **設計D 典型文分類**は予測ではなく「あなたの仮説を、こう読みました」の表示に使う

設計B の限界（別セッションの記述どおり）: AND 合成のみ。否定・OR・例外は未対応。

## 題材の位置づけ（2026-09-20 決定）

- **題材1 注文API = 開発用ダミー。** 骨格と Jev 呼び出しを作るための架空題材。デモには使わない
- **題材2 lru_cache = 本番題材。** [subjects/lru-cache.md](subjects/lru-cache.md)。載せ替えは [backlog.md](backlog.md) T-60〜
- 順番: Jev 読み取りの安定化（題材1で解く）→ 共通スキーマ → 題材2 載せ替え → デモ台本は題材2で

## 当日決めたこと（grill の結果）

[roadmap.md](roadmap.md) 冒頭の表を参照。結果軸4択・仮説は「何を守っているか」・発表者が2分プレイ・confidence 閾値 0.55。

## 環境メモ

- Python はストア版スタブのみで未インストール。題材は TS で書いた
- `tg`（tgrep 1.0.9）を `%USERPROFILE%\.cargo\bin\tg.exe` に導入済み
- `cloudflared` を導入・ログイン済み。Tunnel 公開に Wrangler は不要
- Next.js は create-next-app ではなく手動 scaffold（README.md が既にあり衝突するため）
