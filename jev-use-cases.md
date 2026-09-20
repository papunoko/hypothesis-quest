# Jev ユースケース詳細レポート（公開Web完結版）

作成日: 2026-09-20  
方針: **自己完結**。参照は公開Web（公式ドキュメント、ブログ、報道、GitHub、技術記事）のみ。SNS投稿へのリンクは置かない。

---

## 0. 結論（先に読む）

**Jev** は TypeSafe AI の **System One** 旗艦モデルで、「文章を書くAI」ではなく **ソフトウェアがそのまま使える型付き判断（＋確率／信頼度）を返すAI** である。

実務で効く使い方は次の型に収束する。

1. **意味フィルタ**（行・候補・チャンクに対する yes/no）
2. **ルーティング**（部署・モデル・スキル・次アクションの選択）
3. **信頼度ゲート**（自信が低いときだけ人間／重いLLMへ）
4. **エージェントの判定核**（観測→構造化状態→Jev→実行。生成は別モデル）
5. **評価・採点・並び替え**（関連度、重要度、残すべき履歴、など）

向かないのは長文生成・説明生成・「一問で複合条件を全部聞く」こと。公式もコミュニティも、**小さく聞いてコードで合成する**設計を繰り返し推奨している。

---

## 1. Jev / System One とは何か

### 1.1 定義

TypeSafe の説明では、System One モデルは **状態（state）を評価し、型付きの答えと確率を返す**。Jev はその第一弾。LLMと同様に自然言語を理解するが、**返信文・コード・推論の説明は書かない**。現状の入力はテキスト（文字列・JSON・テキスト配列）。画像・音声・動画は未対応（公式ドキュメント時点）。

- 概念: [System One](https://docs.typesafe.ai/concepts/system-one)
- 発表: [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- 日本語概説: [GIGAZINE](https://gigazine.net/news/20260916-system-one-jev/)、[npaka note](https://note.com/npaka/n/n6f8dd30a5fa4)

名前の「System One」は Kahneman の速い直感的判断（System 1）に寄せた比喩で、長い熟考・長文生成より **短いループで何度も判断する**用途を想定する。

### 1.2 LLMとの差分（設計上のトレードオフ）

| | LLM | Jev (System One) |
| --- | --- | --- |
| 主な出力 | テキスト（必要ならJSONを生成） | **型付き判断＋確率** |
| 強み | 説明・生成・柔軟な対話 | **速度・コスト・構造化・校正された不確実性** |
| 弱み | 遅い／高い／幻覚しうる生成 | **文章を書けない**（説明も出せない） |
| ソフトウェアへの載せ方 | パースしてから使う | **そのまま if / switch / 閾値** |

公式ブログの表現では *unstructured state in, typed probabilistic decisions out*。発表時の訴求として、判断タスクで最上位LLM級の一致率を保ちつつ、レイテンシ・コストを桁で下げる、という位置づけ（数値は公式・報道を参照）。

### 1.3 三つのプリミティブ（これがユースケースの骨格）

公式の問い型は実質この3つ。ユースケースはすべてここに落とし込める。

| プリミティブ | 意味 | 典型出力 | ドキュメント |
| --- | --- | --- | --- |
| **Noul** | はい／いいえの確率 | `probability`（＋confidence） | [Noul](https://docs.typesafe.ai/primitives/noul) |
| **Choice** | 固定候補から1つ（最大多数） | `choice` ＋各候補の確率 | [Choice](https://docs.typesafe.ai/primitives/choice) |
| **Score** | 順序付き段階（尺度） | `score` ＋各段階の確率 | [Score](https://docs.typesafe.ai/primitives/score) |

クイックスタート例（サポート文面）: 「緊急か？」「どのチーム？」「人間確認が要るか？」を **1リクエストに複数問い**で投げられる。  
[Quick start](https://docs.typesafe.ai/introduction/quickstart)

### 1.4 Confidence（第二軸）

答えが「何をするか」、confidence が「自動実行してよいか」。低信頼なら人間や別フローへ。音声バンキング例などが公式パターンにある。  
[Confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing)

### 1.5 触り方（公開経路）

- 公式API: `POST https://api.typesafe.ai/v1/systemone`（[Quick start](https://docs.typesafe.ai/introduction/quickstart)）
- Vercel AI Gateway モデルページ: [vercel.com/ai-gateway/models/jev](https://vercel.com/ai-gateway/models/jev)
- Cloudflare Workers AI でもホスト言及あり（[watany 記事](https://zenn.dev/watany/articles/36e11a20ce3743)）

---

## 2. ユースケース・カタログ（詳細）

以下は **公式クックブック／パターン** と **公開GitHub上の実プロジェクト** を、仕事の型ごとに整理したもの。

### 2.1 意味検索・意味grep（最重要クラス）

**やりたいこと**: 正規表現や埋め込み近傍ではなく、「この命題は成り立つか」で行・段落を拾う。

**公式の型**: 行にIDを付け、Choiceで関連行を順位付けし、同じリクエストのNoulで「文書に答えがあるか」を見る。  
[Line-by-line search](https://docs.typesafe.ai/cookbooks/semantic_find)

**実プロジェクト例**

| リポジトリ | 内容 |
| --- | --- |
| [uehaj/jev-semgrep](https://github.com/uehaj/jev-semgrep) | 意味で探すgrep。行ごとに命題判定。AND/OR/NOT、多言語、`-e` 複数、閾値、依存ほぼゼロのCLI。埋め込み検索との差として「否定・命題の成否」を強調 |
| [superagents-lab/jev-search](https://github.com/superagents-lab/jev-search) | 検索語選定・期間・結果の関連度ソートをJevに任せる検索パイプライン |

**設計メモ**

- 1行＝1命題、または小さなバッチでまとめて問い合わせる。
- 「返金してほしい」と「返金完了」は埋め込みでは近いが、命題としては分かれる——という使い分けがこのクラスの本質。
- 多言語文書でも「意味クエリ」側の言語を揃えなくてもよい、という報告がツール側READMEに載るタイプ。

**向く現場**: CSログ、監査ログ、規約・手順書、多言語混在チケット、インシデントメモ。

---

### 2.2 ナレッジ／エンティティ整合・分類

**公式クックブック**: 二つのカタログから来た候補ペアについて、Scoreの3段階＝「マージ／放置／キュレータへ」を一気に決め、同リクエストのNoulで「どのフィールドが食い違うか」を添える。閾値チューニングを減らす設計。  
[Knowledge graph entity alignment](https://docs.typesafe.ai/cookbooks/entity_alignment)

関連:

- RAG段落の分類: [Classifying RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages)
- 引用のダブルチェック: [Double-checking citations](https://docs.typesafe.ai/cookbooks/citation_check)
- 階層分類: [Hierarchical classification](https://docs.typesafe.ai/cookbooks/hierarchical_classification)

**実務フレーズ**: ノートやファイル群に対し「このメモは『意思決定の根拠』か？」「このチャンクはクエリに答えるか？」をNoul/Scoreで付与し、索引やレビューキューを作る。

---

### 2.3 ルーティング・トリアージ・信頼度ゲート

**パターン**: IntentをChoiceで取り、confidenceで自動／確認／人間を分岐。  
[Confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing)  
[Intent routing](https://docs.typesafe.ai/patterns/intent-routing)

**典型シナリオ**

- サポート: 緊急？／返金？／部署は？／人間レビュー？
- 音声バンキング: 残高照会は低閾値、送金承認は高閾値
- エージェント: 次に呼ぶツール／モデル／スキルをChoice

**実プロジェクト**

| リポジトリ | 内容 |
| --- | --- |
| [gargpratyush/jev-router](https://github.com/gargpratyush/jev-router) | Claude Code / Codex のターンごとに呼ぶモデルを振り分け |
| [EliaAlberti/jev-rules](https://github.com/EliaAlberti/jev-rules) | 依頼や編集対象に応じて渡すルール・参照を選択 |
| [kitze/skillbox](https://github.com/kitze/skillbox) | エージェント用スキル管理＋タスクに合うスキル推薦にJev |

---

### 2.4 ブラウザ／PC／モバイル操作の「判定核」

ここがエコシステムで最も星が集まっている層。**DOMや画面テキストを状態にし、クリック対象・意図をJevが決め、入力など生成が要るときだけ小型LLM**、という分担。

| リポジトリ | 内容 |
| --- | --- |
| [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) | ブラウザ操作の超高速エージェント。要素選択をJevが担当 |
| [awlevin/typesafe-computer-use](https://github.com/awlevin/typesafe-computer-use) | macOSのOCR／アクセシビリティ情報からクリック・入力を自動化 |
| [droidrun/mobile-jev](https://github.com/droidrun/mobile-jev) | 接続Androidの操作（CLI/Web/ログ付き） |
| [moritzkremb/jev-voice-browser](https://github.com/moritzkremb/jev-voice-browser) | 音声認識→意図抽出→Playwright操作（実験） |

**設計原則**

1. 観測をテキスト／構造化stateに落とす（Jevは現状マルチモーダル未対応）
2. 毎ステップの「どれを押すか／進むか止まるか」はJev
3. 自由文入力だけLLM
4. confidence低下時は人手または安全側へ

ビジョン前段と組み合わせる場合（検出は別モデル、判定はJev）は、MetaのセグメンテーションAPIなど公開ビジョン基盤とパイプラインを組む形になる。  
[SAM 3.1（Meta）](https://ai.meta.com/blog/sam-3-1/)

---

### 2.5 コーディングエージェントの監督・履歴圧縮・レビュー

| リポジトリ | 内容 |
| --- | --- |
| [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | Claude Code履歴のツール呼び出しをJevで採点し、不要を削除・短縮（残す文は原文のまま） |
| [thruwire/foreman](https://github.com/thruwire/foreman) | Codex自律作業をJevが監督（継続／検証／停止） |
| [devagrawal09/jev-review](https://github.com/devagrawal09/jev-review) | Git差分・リポジトリの段階的レビューとローカル画面 |
| [DevMortimer/pi-warden](https://github.com/DevMortimer/pi-warden) | エージェントのルール違反・同じ失敗の反復・未検証完了を監視 |

**ハーネス視点の解説記事**: 許可判断のAuto-Modeや grilling の一次評価にJevを挟む実験。  
[Jevでハーネスエンジニアリング（Zenn / watany）](https://zenn.dev/watany/articles/36e11a20ce3743)  
関連実装: [watany-dev/jev-playground](https://github.com/watany-dev/jev-playground)

ここでのJevの役割は「コードを書くこと」ではなく、**危険操作か／この要約を残すか／レビューを続けるか**のゲート。

---

### 2.6 MCP・シェル・開発者体験

| リポジトリ | 内容 |
| --- | --- |
| [itsmostafa/typesafe-mcp](https://github.com/itsmostafa/typesafe-mcp) | MCP経由でJevの選択・採点・真偽を呼ぶ非公式コネクタ |
| [mrnugget/jev-shell-history](https://github.com/mrnugget/jev-shell-history) | zsh入力に合う過去コマンドをJevが選んで補完 |

---

### 2.7 検索・DB・グラフ（「ソート／フィルタを意味でハック」）

| リポジトリ | 内容 |
| --- | --- |
| [realZachi/pg-jev](https://github.com/realZachi/pg-jev) | PostgreSQL拡張。自然言語条件で行の絞り込み・分類・順位付け（データは外部APIへ） |
| [superagents-lab/jev-search](https://github.com/superagents-lab/jev-search) | Web検索パイプラインの関連度制御 |
| [jexp/neo4jev](https://github.com/jexp/neo4jev) | Neo4jで次に辿る関係をJevに選ばせる探索デモ |

公式の再ランク系: [Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe)

**注意**: DB拡張系は行内容がAPIに送られる。PII設計が必須。

---

### 2.8 閲覧体験・動画・コミュニティ

| リポジトリ | 内容 |
| --- | --- |
| [kitze/unclutter](https://github.com/kitze/unclutter) | 広告枠・邪魔なUIをJevで識別して非表示にする拡張 |
| [ChetasLua/jevmeter](https://github.com/ChetasLua/jevmeter) | 動画発言を観点スコア化しメーター付き動画を生成（事実確認用途ではない） |
| [trungdq88/youtube-sponsor-detection](https://github.com/trungdq88/youtube-sponsor-detection) | 字幕／音声からスポンサー区間を判定してスキップ |
| [brainstormity/Jev-Moderation-Bot](https://github.com/brainstormity/Jev-Moderation-Bot) | Discordのスパム・詐欺URL判定（誤判定時の管理対応前提） |
| [usenotra/notra](https://github.com/usenotra/notra) | AI回答でのブランド言及追跡（GEO）。好意度や順位分類にJev |

公式のLLMガードレール: [Guardrails for LLMs](https://docs.typesafe.ai/cookbooks/llm_guardrails)

---

### 2.9 スマートホーム・シミュレーション・売買実験

| リポジトリ | 内容 |
| --- | --- |
| [AboveColin/HA-Jev](https://github.com/AboveColin/HA-Jev) | Home Assistant状態の判定（日常自動化向け。安全設備用途ではない旨の注意が付きやすい類） |
| [fhshaik/typesafe-mario](https://github.com/fhshaik/typesafe-mario) | エミュレータ状態からマリオの行動をJevが選択 |
| [standardagents/jevpilot](https://github.com/standardagents/jevpilot) | Three.js走行シミュレータで進路・速度候補を選択 |
| [RomanSlack/jev-drone](https://github.com/RomanSlack/jev-drone) | MuJoCoドローンで回避判断 |
| [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader) | チェーン上取引の実験（mock/dry-run前提。収益性未検証が普通） |

デモ公式: [Smart home assistant demo](https://docs.typesafe.ai/demos/smart-home)

これらは「リアルタイム制御ループに載る速さ」のデモ／実験であり、本番安全系に直結させるにはconfidenceゲートとハード制約が別途必要。

---

### 2.10 オープン実装・互換研究（公式Jev本体ではない）

コミュニティまとめでも明示的に切り分けられる層。

| リポジトリ | 内容 |
| --- | --- |
| [TheoLeeCJ/SemIf](https://github.com/TheoLeeCJ/SemIf) | 公開モデルで選択肢確率を読む独立研究（旧OpenJev系の文脈） |
| [vinnylarouge/jevlike](https://github.com/vinnylarouge/jevlike) | 可変長候補を一括評価する小型モデル学習の研究起点 |
| [TianyuCodings/NanoJev](https://github.com/TianyuCodings/NanoJev) | 並列判断のナノ複製・学習コード・デモ |
| [ekzhang/openjev-sglang](https://github.com/ekzhang/openjev-sglang) | Qwen＋SGLang系の互換API実装 |
| Diffusion系をJevパラダイムで回す議論 | 例: [vLLM PR #57250](https://github.com/vllm-project/vllm/pull/57250)（並列・非自己回帰で構造化選択を評価する方向） |

カタログ系:

- [cobanov/awesome-jev](https://github.com/cobanov/awesome-jev)
- [Anil-matcha/awesome-jev-by-typesafe](https://github.com/Anil-matcha/awesome-jev-by-typesafe)
- [yibie/awesome-jev](https://github.com/yibie/awesome-jev)

---

## 3. 「仕事の型」としての設計パターン

公式の [use-case map](https://docs.typesafe.ai/concepts/use-case-map) とパターン集を、実装手順に翻訳する。

### パターンA — 単問Noulフィルタ

```
state = 観測テキスト or JSON要約
ask: 「これはXか？」 (Noul)
if p >= thr_high: 自動でX扱い
elif p <= thr_low: 自動で非X
else: 人間 or 重いモデル
```

### パターンB — 複合条件は分解してコードでAND/OR

悪い例: 「緊急かつ返金かつ営業か？」を1 Choice/1 Noulに詰める。  
良い例: 緊急？／返金？／営業？を別Noul → アプリ側で論理結合。

広いChoice（例: 140カテゴリ一発）より、上位ジャンルのyes/noを重ねる方が安定しやすい、という運用知見がコミュニティ側でも繰り返される。公式にも階層分類クックブックがある。

### パターンC — Scoreで「次アクションの種類」を尺度化する

エンティティ整合のように、尺度の各段＝ビジネスアクション（マージ／放置／レビュー）にすると、閾値探索が減る。  
[entity alignment](https://docs.typesafe.ai/cookbooks/entity_alignment)

### パターンD — 生成AIの前段／後段ガード

入力のプロンプトインジェクション疑い、出力のポリシー違反、引用の妥当性などをNoul/Scoreで見てから表示。  
[llm_guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails)

### パターンE — エージェント・ハーネス

許可プロンプト、コンパクション、レビュー継続、スキル選択をJevに寄せ、LLMは「考える・書く」に集中。  
[watany記事](https://zenn.dev/watany/articles/36e11a20ce3743)

### パターンF — 計算はDB、意味はJev

明細500行を投げず、「先月同加盟店3回・平均額…」までSQLで畳んでから意味判定。金融・家計ではPII除去が必須、という運用が実例として語られる。

---

## 4. アンチパターンと運用チェックリスト

1. **文章生成を期待する** — できない。説明が要るなら別モデル。
2. **一問に条件を詰め込む** — 精度と解釈が崩れる。
3. **巨大Choice一発** — 分解か階層化。
4. **confidenceを見ない** — 自動実行の事故率が増える。
5. **生PIIをstateに載せる** — 外部API前提の拡張・エージェントで特に危険。
6. **ビジョンを直接食わせる** — 現状テキスト化前段が必要。
7. **売買・安全制御をデモのまま本番化** — ハード制約と人間ゲートなしでは不可。

チェックリスト（本番前）:

- [ ] 各問いは単一命題か
- [ ] 自動実行閾値とフォールバックが定義されているか
- [ ] stateに送るフィールドの最小化・マスキング
- [ ] レイテンシ予算（70–500ms帯の公式イメージ）に合っているか
- [ ] 失敗時（APIエラー・低confidence）の既存ルール復帰

---

## 5. 公開エコシステム俯瞰（ジャンル別リポジトリ）

以下は公開GitHub上で確認できる代表例（スター数は変動する）。**公式Jevそのものの複製ではない研究実装**は節2.10に分離済み。

### 操作系
- [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast)
- [awlevin/typesafe-computer-use](https://github.com/awlevin/typesafe-computer-use)
- [droidrun/mobile-jev](https://github.com/droidrun/mobile-jev)
- [moritzkremb/jev-voice-browser](https://github.com/moritzkremb/jev-voice-browser)

### 開発エージェント系
- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction)
- [thruwire/foreman](https://github.com/thruwire/foreman)
- [devagrawal09/jev-review](https://github.com/devagrawal09/jev-review)
- [gargpratyush/jev-router](https://github.com/gargpratyush/jev-router)
- [EliaAlberti/jev-rules](https://github.com/EliaAlberti/jev-rules)
- [DevMortimer/pi-warden](https://github.com/DevMortimer/pi-warden)

### データ・検索系
- [uehaj/jev-semgrep](https://github.com/uehaj/jev-semgrep)
- [realZachi/pg-jev](https://github.com/realZachi/pg-jev)
- [superagents-lab/jev-search](https://github.com/superagents-lab/jev-search)
- [jexp/neo4jev](https://github.com/jexp/neo4jev)

### UX・コミュニティ・マーケ
- [kitze/unclutter](https://github.com/kitze/unclutter)
- [ChetasLua/jevmeter](https://github.com/ChetasLua/jevmeter)
- [trungdq88/youtube-sponsor-detection](https://github.com/trungdq88/youtube-sponsor-detection)
- [brainstormity/Jev-Moderation-Bot](https://github.com/brainstormity/Jev-Moderation-Bot)
- [usenotra/notra](https://github.com/usenotra/notra)

### 制御・実験
- [AboveColin/HA-Jev](https://github.com/AboveColin/HA-Jev)
- [fhshaik/typesafe-mario](https://github.com/fhshaik/typesafe-mario)
- [standardagents/jevpilot](https://github.com/standardagents/jevpilot)
- [RomanSlack/jev-drone](https://github.com/RomanSlack/jev-drone)
- [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader)

### カタログ
- [cobanov/awesome-jev](https://github.com/cobanov/awesome-jev)
- [Anil-matcha/awesome-jev-by-typesafe](https://github.com/Anil-matcha/awesome-jev-by-typesafe)

---

## 6. 公式クックブック早見（公開Docs）

| トピック | URL |
| --- | --- |
| System One概念 | https://docs.typesafe.ai/concepts/system-one |
| Use case map | https://docs.typesafe.ai/concepts/use-case-map |
| Quick start | https://docs.typesafe.ai/introduction/quickstart |
| Noul / Choice / Score | https://docs.typesafe.ai/primitives/noul · [choice](https://docs.typesafe.ai/primitives/choice) · [score](https://docs.typesafe.ai/primitives/score) |
| 行単位意味検索 | https://docs.typesafe.ai/cookbooks/semantic_find |
| エンティティ整合 | https://docs.typesafe.ai/cookbooks/entity_alignment |
| Confidence routing | https://docs.typesafe.ai/patterns/confidence-routing |
| Intent routing | https://docs.typesafe.ai/patterns/intent-routing |
| LLMガードレール | https://docs.typesafe.ai/cookbooks/llm_guardrails |
| RAG段落分類 | https://docs.typesafe.ai/cookbooks/classifying_rag_passages |
| 並列問い | https://docs.typesafe.ai/cookbooks/parallel_questions |
| モデル・ギザギザ特性 | https://docs.typesafe.ai/model-jaggedness/jev-1.13 |
| 全体index | https://docs.typesafe.ai/llms.txt |

---

## 7. 導入ロードマップ（実務向け）

1. **PlaygroundまたはGatewayで三プリミティブを体感**（[Quick start](https://docs.typesafe.ai/introduction/quickstart) / [Vercel Jev](https://vercel.com/ai-gateway/models/jev)）
2. **意味grepまたはチケット1分類**を本番データのコピーでPoC（[semantic_find](https://docs.typesafe.ai/cookbooks/semantic_find) / [jev-semgrep](https://github.com/uehaj/jev-semgrep)）
3. **confidence閾値とフォールバック**を先に決める（[confidence-routing](https://docs.typesafe.ai/patterns/confidence-routing)）
4. エージェントに入れるなら **操作選択だけJev**（[jev-ultrafast](https://github.com/browser-use/jev-ultrafast) 系の分担）
5. 履歴圧縮・レビューゲートは第二波（[fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) 等）
6. マルチモーダル要求は **検出モデル→テキストstate→Jev** の二段（[SAM 3.1](https://ai.meta.com/blog/sam-3-1/)）

---

## 8. 限界・免責

- 本レポートは公開Webの記述と公開リポジトリ説明に基づく。各repoの動作保証・セキュリティ監査は行っていない。
- 星の数・料金・レイテンシは時点依存。必ず一次情報を確認すること。
- 「Jev」名を冠していても公式APIを使わない研究実装がある。節2.10を混同しないこと。
- 商用利用・データ送信・ライセンスは各サービス／各リポジトリの規約に従うこと。

---

## 9. 参考文献（公開Webのみ）

**公式・製品**

- https://typesafe.ai/blog/introducing-system-one-models-and-jev
- https://docs.typesafe.ai/concepts/system-one
- https://docs.typesafe.ai/introduction/quickstart
- https://docs.typesafe.ai/concepts/use-case-map
- https://docs.typesafe.ai/llms.txt
- https://vercel.com/ai-gateway/models/jev

**解説**

- https://gigazine.net/news/20260916-system-one-jev/
- https://note.com/npaka/n/n6f8dd30a5fa4
- https://zenn.dev/watany/articles/36e11a20ce3743

**周辺**

- https://ai.meta.com/blog/sam-3-1/
- https://github.com/vllm-project/vllm/pull/57250

**リポジトリ**は本文各表のURLを参照。
