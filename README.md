# 仮説クエスト (Hypothesis Quest)

現在の作業先は `C:/Users/ABC/pj/jev-hathon`。**[ebiharadev.org](https://ebiharadev.org) で公開中**（Cloudflare Workers + D1）。公開は2026年9月30日いっぱい、日本時間10月1日0時に画面・APIを自動停止します。[運用手順](docs/deployment.md) を参照。派生worktreeは削除済みです。

## 3002版：LLM回答とレビュー提出

LLM回答・最終提出・UI調整は元フォルダに統合済み。開発サーバーは3002、Workersプレビューは8787です。

```powershell
npm ci
# .dev.vars: JEV_API_KEY と OLLAMA_API_KEY（値はGitに入れない）
npm run dev              # http://localhost:3002
npm run eval:narration   # 実LLM生成とJev検問の評価
```

- 質問には検証済みの比較結果を使ってLLMが回答。通常は原因を先に明かさず、「理由も知りたい」でヒントを開ける。
- レビュー画面で最後の仮説・判断・コメントを入力し、**明示的に提出**すると7事例を照合してLLMが返答。D1に提出と返答を保存し、後から読み返せる。GitHubへの投稿・マージ操作はしない。
- 生成はOllama Cloudの `gemma4:31b`（`OLLAMA_MODEL`で変更可）。JevのNoulで根拠外の主張・個人の採点を検問し、通常質問では原因の先出しも検問。0.30以上または通信・形式エラーなら生成文を表示せず定型文に戻す。検問は誤りゼロの保証ではない。
- 質問文／提出文と、その場で必要な実測・確認した質問の要約をOllama Cloudへ送信。生成文と根拠をJevへ送信する。入力中のLLM呼び出しはない。秘密情報は入力しないこと。
- 保存先はD1（開発中は `.wrangler/state`）、Cookie名は互換性のため `quest-session-3002` を継続。旧SQLiteは保持するが自動移行しない。WorkerにIP別レート制限を実装済み。認証・自動削除は未実装。
- レビュー提出後も「質問・観察を続ける」で下書き・回答を残して探索へ戻れる。「新しいセッションを始める」は確認後にアプリCookieのみ切り替える。旧履歴へUIから戻れなくなるが、DBの削除ではない。
- 未検証の任意コードの実行や、任意の質問への回答保証はしない。生成文を根拠に実結果やクリア判定を書き換えることもない。

以下の古い記録に3000/3001の起動例があるが、このツリーで試すポートは3002。

最新の検証結果・デプロイ済み範囲は [HANDOFF](docs/HANDOFF.md) を参照。検問の評価スクリプトでは通常回答・ヒント・提出解説の生成と、根拠外の断定／原因の先出しの非表示を確認します。検問の成功は任意の生成文の正しさの保証ではありません。

> AI成果物を **読む** 代わりに、**自分の説明を書いて試す** ミニゲーム。

TypeSafe Jev ハッカソンの制作物。Jevは「理解度の採点」ではなく、**あなたが書いた自然文の仮説を読み取る**ために使う。

---

## 何を解くのか

AIは1時間で3000行書く。人間がそれを理解するには3日かかる。
解説を読んでも「わかった気」にしかならない ―― **理解がボトルネック**になっている。

だから、読むのをやめる。**自分の言葉で「この仕組みが守ろうとしているルール」を書く。**
すると、その説明では扱えない事例が向こうからやってくる。

## 体験の一巡

```
  あなたが一文の仮説を書く
        「同じ商品は重複して登録しない」
              │
              ▼
  Jev が仮説の条件を読み取り、コードが各事例に当てはめる
              │
              ▼
  コードが、事前に検証済みの実際の結果と照合する
              │
              ▼
  食い違う事例が出てくる
        事例B 意図的な2件目 → 予想 1件 / 実際 2件  ✗
              │
              ▼
  「商品が同じかじゃなく、同じ依頼かどうかだ」と書き直す
```

用語を覚えてから例題を解くのではない。**自分が遭遇した問題に、あとから用語と構造が結びつく。**

## Jevの役割（設計の核心）

| 担当 | 仕事 |
| --- | --- |
| **Jev** | 自然文の仮説から4軸の条件を読み取る（Noul、1リクエスト） |
| **コード** | 条件を事例に当てはめて予想し、実結果と照合して次の事例を選ぶ |
| **人間** | 仮説を書く。Jevの読み取りが違っていたら訂正する |

**Jevに正解を判定させない。** これによって、AIが反例を捏造できず、「AIに理解度を採点される」不快感も構造的に発生しない。Jevのconfidenceが低いときは「理解不足」ではなく **解釈の確認** に回す。

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/concept.md](docs/concept.md) | 企画の詳細。題材・事例カード・Jev呼び出し設計・不可侵ルール |
| [docs/roadmap.md](docs/roadmap.md) | フェーズと到達点。どこまで作れば成立するか |
| [docs/backlog.md](docs/backlog.md) | 実装タスク一覧 |
| [docs/decisions.md](docs/decisions.md) | なぜこの1本に絞ったか。検討した8案と不採用理由 |
| [docs/deployment.md](docs/deployment.md) | Workers + D1 / ebiharadev.org の設定・Secrets・デプロイ手順 |
| [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) | **本番題材**: functools.lru_cache。事例8枚・出典イシュー・コードへの戻り先 |
| [docs/journey.md](docs/journey.md) | 本番題材のプレイ体験。メンテナとして PR をレビューする導入・軸の実測・入力中の鏡と「直観の声」（LLM+Jev検閲）・4手のジャーニー・台本 |
| [docs/harness.md](docs/harness.md) | 体験と題材を批判的に測るハーネス。固定戦略ボット・帳面レポート・題材検査・jev-lint（自然言語ルール）・スキル。結果は `docs/eval/` |
| [docs/research/jev-use-cases.md](docs/research/jev-use-cases.md) | 公開Jevユースケース調査（公式Docs・OSS） |
| [docs/research/chatgpt-rally.txt](docs/research/chatgpt-rally.txt) | 企画の原典。TRPG／数学ガール／ゲーム設計論の往復ログ |

## ローカルで動かす

```powershell
npm ci
# .dev.vars に JEV_API_KEY / OLLAMA_API_KEY を保存する
npm run dev       # D1 migration後 http://localhost:3002
npm test          # 事例判定・検問・D1保存など
```

## 検証する

検証は `npm test`（ローカルD1を含む）と `npm run eval:jev`（注文APIの実Jev評価）、`npm run eval:lru`（題材2の14仮説）、`npm run eval:questions`（質問等9入力）。件数・結果はHANDOFFに記録する。
ブラウザテストには [Playwright](https://playwright.dev/docs/test-webserver) を使用する。
初回に `npx playwright install chromium` を実行してから、以下を使う。

```powershell
npm run test:e2e       # 画面回帰（API応答固定）
npm run test:e2e:live  # 実Jev/LLM（質問・帳面・提出の保存と復元を含む）
```

テスト用サーバーはlocalhost:3002。Workersプレビューを検証する場合は `PLAYWRIGHT_BASE_URL=http://localhost:8787` を設定。スクリーンショットと失敗時traceは `test-results/`。
注文APIの動作確認台本は [docs/demo-orders.md](docs/demo-orders.md)。

## Cloudflare Workersで公開する

`npm run preview` でWorkersをローカル確認、`npm run deploy` で更新できます。D1・Secrets・本番Routeは設定済みです。再デプロイでも9月末の公開期限を維持してください。[運用手順](docs/deployment.md) を参照。

## 題材

| | 題材 | 位置づけ |
| --- | --- | --- |
| 題材1 | 架空の注文登録API（Idempotency-Key） | **開発用ダミー。** `/orders` に保持 |
| 題材2 | `functools.lru_cache` | **本番題材。** 実イシュー由来の事例8枚。デモはこちらで行う → [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) |

## 現状

**質問も受け付けます。** 「型は関係ある？」と聞くと、Jevが入力の種別・話題を読み、コードがL5/L6の実測から「場合による」と返して2枚並べます。答える対象の問いを明示し、未検証の質問は「まだ答えられません」と返します。曖昧な入力は質問／仮説の選択で確認できます。

**入力はD1に保存**します（開発中はローカル、本番ではCloudflare）。入力・読み取り・返答・提示事例・時刻・提出を保存。入力文はTypeSafe Jevへ、質問・提出時の文と限定した根拠はOllama Cloudへ送信します。秘密情報は入力しないでください。

帳面はブラウザのセッションCookieで分離され、再読み込み後も復元できます。Cookieが失われると元の帳面への画面上のアクセスも失われますが、DBは自動削除されません。「もう一周する」は帳面の削除ではありません。保持期間・DB削除導線は未整備。公開レート制限と期限は [deployment.md](docs/deployment.md) を参照。

**トップ画面は題材2。** 実在のbpo-39554を背景にした演習用PRを読み、現状の振る舞いを仮説と7事例で確かめ、レビュー下書きを書く。入力中の読み取り・L5/L6比較・コード行へのリンク付き。L8は別論点として開ける。

`npm run verify:lru` はWSLのCPython 3.12.3で9件（L1〜L8とH1）の実結果と画面データを照合する。`npm run eval:lru` は実Jevの14文評価（不一致があれば終了コード1）。直近の期待事例一致は11/14で、否定や複合例外の読みには課題が残る。詳細は [docs/HANDOFF.md](docs/HANDOFF.md)。

## 構成

```
src/subject/orders.ts       題材（AIが書いた想定の注文API・Idempotency-Key）
src/subject/orders.test.ts  6事例の実結果が題材コードと一致することの検証記録
src/subject/cases.ts        事例カード6枚 + 未確認の論点
src/lib/jev.ts              Jev 呼び出し（仮説文のみ渡す。実結果は渡さない）
src/lib/select.ts           照合と、次に出す事例の選択（コード側）
src/app/api/predict/        APIルート1本（キーはサーバー側）
src/app/page.tsx            画面1枚
```

Next.js + React + TypeScript + OpenNext + Cloudflare Workers/D1。Jevが入力を読み、コードが事例から回答・照合を行い、Ollamaの生成文をJevが検問します。入力中のLLMの声・曖昧文の分割は保留です。
