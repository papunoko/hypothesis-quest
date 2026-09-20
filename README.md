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
  Jev がその仮説を読み取り、各事例の結果を予想する
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
| **Jev** | 自然文の仮説を読み取り、「この仮説に従えば結果はどうなるか」を予想する（Choice） |
| **コード** | 予想と、事前検証済みの実際の結果を照合し、次に出す事例を選ぶ |
| **人間** | 仮説を書く。Jevの読み取りが違っていたら訂正する |

**Jevに正解を判定させない。** これによって、AIが反例を捏造できず、「AIに理解度を採点される」不快感も構造的に発生しない。Jevのconfidenceが低いときは「理解不足」ではなく **解釈の確認** に回す。

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/concept.md](docs/concept.md) | 企画の詳細。題材・事例カード・Jev呼び出し設計・不可侵ルール |
| [docs/roadmap.md](docs/roadmap.md) | フェーズと到達点。どこまで作れば成立するか |
| [docs/backlog.md](docs/backlog.md) | 実装タスク一覧 |
| [docs/decisions.md](docs/decisions.md) | なぜこの1本に絞ったか。検討した8案と不採用理由 |
| [docs/subjects/lru-cache.md](docs/subjects/lru-cache.md) | 題材2: functools.lru_cache。事例8枚・出典イシュー・コードへの戻り先 |
| [docs/research/jev-use-cases.md](docs/research/jev-use-cases.md) | 公開Jevユースケース調査（公式Docs・OSS） |
| [docs/research/chatgpt-rally.txt](docs/research/chatgpt-rally.txt) | 企画の原典。TRPG／数学ガール／ゲーム設計論の往復ログ |

## 動かす

```
npm install
echo JEV_API_KEY=<your key> > .env.local
npm run dev        # http://localhost:3000
npm test           # 事例カード6枚の実結果を題材コードで検証
```

## 現状

**成立ライン（S1）まで実装済み。** 仮説を書くと Jev が読み取り、食い違う事例が出る。
残りはデモ台本と冒頭の語り → [docs/backlog.md](docs/backlog.md)。

## 構成

```
src/subject/orders.ts       題材（AIが書いた想定の注文API・Idempotency-Key）
src/subject/orders.test.ts  6事例の実結果が題材コードと一致することの検証記録
src/subject/cases.ts        事例カード6枚 + 未確認の論点
src/lib/jev.ts              Jev 呼び出し（仮説＋操作列のみ渡す。実結果は渡さない）
src/lib/select.ts           照合と、次に出す事例の選択（コード側）
src/app/api/predict/        APIルート1本（キーはサーバー側）
src/app/page.tsx            画面1枚
```

Next.js + React + TypeScript。生成LLM・キャラクター設定・長期記憶・RAGは **初版では使わない。**
