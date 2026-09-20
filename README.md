# 仮説クエスト (Hypothesis Quest)

現在の作業先は `C:/Users/ABC/pj/jev-hathon`。3002版のLLM回答・最終提出・UI調整を統合済み。以下の別worktreeの説明は分離開発時の記録です。起動中の元フォルダ版は http://localhost:3001 で確認できます（`npm run dev` の既定は3002）。

## 3002版：LLM回答とレビュー提出

この作業ツリーは `C:/Users/ABC/pj/jev-hathon-3002`、ブランチは `llm-3002`。元の3001版（`../jev-hathon`）と別のソース・`.next`・SQLiteで動きます。3001の起動中プロセスを止める必要はありません。

```powershell
npm ci
# .env.local: JEV_API_KEY と OLLAMA_API_KEY（値はGitに入れない）
npm run dev              # http://localhost:3002
npm run eval:narration   # 実LLM生成とJev検問の評価
```

- 質問には検証済みの比較結果を使ってLLMが回答。通常は原因を先に明かさず、「理由も知りたい」でヒントを開ける。
- レビュー画面で最後の仮説・判断・コメントを入力し、**明示的に提出**すると7事例を照合してLLMが返答。SQLiteに提出と返答を保存し、後から読み返せる。GitHubへの投稿・マージ操作はしない。
- 生成はOllama Cloudの `gemma4:31b`（`OLLAMA_MODEL`で変更可）。JevのNoulで根拠外の主張・個人の採点を検問し、通常質問では原因の先出しも検問。0.30以上または通信・形式エラーなら生成文を表示せず定型文に戻す。検問は誤りゼロの保証ではない。
- 質問文／提出文と、その場で必要な実測・確認した質問の要約をOllama Cloudへ送信。生成文と根拠をJevへ送信する。入力中のLLM呼び出しはない。秘密情報は入力しないこと。
- SQLiteはこのツリーの `data/notebook.sqlite`、Cookie名は `quest-session-3002`。3001の帳面・Cookieは変更しない。自動削除・公開向けの認証／レート制限は未実装。
- 未検証の任意コードの実行や、任意の質問への回答保証はしない。生成文を根拠に実結果やクリア判定を書き換えることもない。

以下の古い記録に3000/3001の起動例があるが、このツリーで試すポートは3002。

3002版の確認結果：単体28件、Playwright16件（実Jev/LLM4件）、本番ビルド通過。検問の評価スクリプトでは通常回答・ヒント・提出解説の生成と、根拠外の断定／原因の先出しの非表示を確認しています。

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
| [docs/deployment.md](docs/deployment.md) | Cloudflare Tunnel で公開する手順・固定URL・運用上の注意 |
| [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) | **本番題材**: functools.lru_cache。事例8枚・出典イシュー・コードへの戻り先 |
| [docs/journey.md](docs/journey.md) | 本番題材のプレイ体験。メンテナとして PR をレビューする導入・軸の実測・入力中の鏡と「直観の声」（LLM+Jev検閲）・4手のジャーニー・台本 |
| [docs/research/jev-use-cases.md](docs/research/jev-use-cases.md) | 公開Jevユースケース調査（公式Docs・OSS） |
| [docs/research/chatgpt-rally.txt](docs/research/chatgpt-rally.txt) | 企画の原典。TRPG／数学ガール／ゲーム設計論の往復ログ |

## ローカルで動かす

```powershell
npm ci
# .env.local に JEV_API_KEY=<your key> を保存する
npm run dev       # http://localhost:3000
npm test          # 事例カード6枚の実結果を題材コードで検証
```

## 検証する

検証は `npm test`（23件）と `npm run eval:jev`（注文APIの実Jev評価）、`npm run eval:lru`（題材2の14仮説）、`npm run eval:questions`（質問等9入力）。
ブラウザテストには [Playwright](https://playwright.dev/docs/test-webserver) を使用する。
初回に `npx playwright install chromium` を実行してから、以下を使う。

```powershell
npm run test:e2e       # 画面回帰10件
npm run test:e2e:live  # 実Jev3件（質問・帳面の保存と復元を含む）
```

テスト用サーバーはlocalhost:3001。スクリーンショットと失敗時traceは `test-results/`。
注文APIの動作確認台本は [docs/demo-orders.md](docs/demo-orders.md)。

## Cloudflare Tunnel で公開する

このリポジトリの公開方法は、ローカルで動かす Next.js の本番サーバーを
`cloudflared` でインターネットへ接続する構成を前提にする。

ターミナル1:

```powershell
npm ci
npm test
npm run build
npm start
```

ターミナル2:

```powershell
cloudflared tunnel --url http://localhost:3000
```

表示された `https://....trycloudflare.com` を共有する。URLは起動ごとに変わり、
`npm start` または `cloudflared` を止めるとアクセスできなくなる。

**この方法に Wrangler は不要。** Wrangler が必要になるのは、Next.js 自体を
Cloudflare Workers へ配置する構成へ切り替える場合。固定URLを使う Named Tunnel、
秘密情報の扱い、終了方法は [デプロイ手順](docs/deployment.md) を参照。

## 題材

| | 題材 | 位置づけ |
| --- | --- | --- |
| 題材1 | 架空の注文登録API（Idempotency-Key） | **開発用ダミー。** `/orders` に保持 |
| 題材2 | `functools.lru_cache` | **本番題材。** 実イシュー由来の事例8枚。デモはこちらで行う → [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) |

## 現状

**質問も受け付けます。** 「型は関係ある？」と聞くと、Jevが入力の種別・話題を読み、コードがL5/L6の実測から「場合による」と返して2枚並べます。答える対象の問いを明示し、未検証の質問は「まだ答えられません」と返します。曖昧な入力は質問／仮説の選択で確認できます。

**入力はローカルSQLiteに保存**します（Node 26の `node:sqlite`、`data/notebook.sqlite`、Git対象外）。保存するのは送信して回答を得た入力・読み取り・返答・提示事例・時刻。帳面そのものは外部送信しませんが、入力文は読み取りのためTypeSafe Jevへ送信します。秘密情報は入力しないでください。

帳面はブラウザのセッションCookieで分離され、再読み込み後も復元できます。Cookieが失われると元の帳面への画面上のアクセスも失われますが、DBは自動削除されません。「もう一周する」は帳面の削除ではありません。公開時には保持期間・削除導線・レート制限の整備が別途必要です。

**トップ画面は題材2。** 実在のbpo-39554を背景にした演習用PRを読み、現状の振る舞いを仮説と7事例で確かめ、レビュー下書きを書く。入力中の読み取り・L5/L6比較・コード行へのリンク付き。L8は別論点として開ける。

`npm run verify:lru` はWSLのCPython 3.12.3で8件の実結果と画面データを照合する。`npm run eval:lru` は実Jevの14文評価（不一致があれば終了コード1）。直近の期待事例一致は11/14で、否定や複合例外の読みには課題が残る。詳細は [docs/HANDOFF.md](docs/HANDOFF.md)。

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

Next.js + React + TypeScript + SQLite。Jevが入力を読み、コードが検証済み事例から回答・事例選択を行います。相棒の文は現状固定。ユーザー確認により入力中のLLMの声は保留し、次は曖昧文の書き直しと検問付き提出解説を予定しています（[concept §12](docs/concept.md)、backlog U）。
