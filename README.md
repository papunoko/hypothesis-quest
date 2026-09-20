# 仮説クエスト (Hypothesis Quest)

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

検証は `npm test`（14件）と `npm run eval:jev`（実APIで6仮説）。
ブラウザテストには [Playwright](https://playwright.dev/docs/test-webserver) を使用する。
初回に `npx playwright install chromium` を実行してから、以下を使う。

```powershell
npm run test:e2e       # 画面回帰4件（API応答を固定）
npm run test:e2e:live  # 実Jevで商品→C3、依頼ID→C4を確認
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
| 題材1 | 架空の注文登録API（Idempotency-Key） | **開発用ダミー。** 骨格と Jev 呼び出しを作るための題材。いま画面に載っているのはこれ |
| 題材2 | `functools.lru_cache` | **本番題材。** 実イシュー由来の事例8枚。デモはこちらで行う → [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) |

## 現状

**題材1で成立ライン（S1）まで実装済み。** 仮説を書くと Jev が読み取り、食い違う事例が出る。
ただし Jev の読み取りはまだ安定していない → [docs/HANDOFF.md](docs/HANDOFF.md)。
次は題材2への載せ替え → [docs/backlog.md](docs/backlog.md) T-60〜。

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

Next.js + React + TypeScript。生成LLM・キャラクター設定・長期記憶・RAGは **初版では使わない。**
