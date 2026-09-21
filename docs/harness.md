# ハーネス — 体験と題材を批判的に測る道具

最終更新: 2026-09-20
原則: **測ることはスクリプト、読んで書いて決めることはスキル。** スクリプトだけだと判断が残らず、スキルだけだと毎回ぶれる。スキルはスクリプトを呼ぶ手順書として置く。
結果は `docs/eval/` に日付付きで残す。批評（journey-check）はこの記録を入力にする。

2026-09-20 夜: stress/subject:checkは同日再実行で記録を上書きしないようUTC時刻付きファイル名へ変更。eval:lruも読み取り・期待選択を時刻付きJSONに保存する。修正後の批評は `eval/journey-check-2026-09-20-quality.md`。初回の失敗記録は保持した。

---

## 1. 配置

```
.claude/skills/            Claude Code が読む（Codex 等は .agents/skills/）
  subject-forge/           題材を作る手順。scripts/subject/* を順に呼ぶ
  journey-check/           体験を批評する固定の問い。docs/eval/ を読む
  jev-lint/                外部（mizchi/jev-lint）。ルールの書き方・calibrate の手順
  game-design-reality-check/   外部（qiuaoru-coder）。面白さの主張を検証可能な仮説に分ける
  stress-testing-game-concepts/ 外部（abagames）。単純方策で攻略されるか
rules/                     jev-lint の自然言語ルール（fixtures / expect.yml / baseline.json 付き）
scripts/harness/           stress-bots / notebook-report / jev-lint ラッパー
scripts/subject/           mine / rank / check / specs
docs/eval/                 日付付きの記録（消さない）
.jev-lint.yaml             jev-lint 設定（鍵は .dev.vars の JEV_API_KEY）
```

## 2. コマンド

| やること | コマンド | 実体 | API |
| --- | --- | --- | --- |
| 固定戦略ボット | `npm run harness:stress` | `scripts/harness/stress-bots.mts` | Jev 約15回 |
| 帳面レポート | `npm run harness:notebook [-- --db x.sqlite]` | `scripts/harness/notebook-report.mts` | なし |
| 助け舟の判定プローブ | `npm run harness:support [-- --repeat 2]` | `scripts/harness/support-probe.mts` | 実 Jev（9 件×回数） |
| 題材検査 | `npm run subject:check [-- --spec scripts/subject/specs/lru-cache.json]` | `scripts/subject/check.mts` | Jev 3回 + LLM 1回 |
| 題材候補の収集 | `npm run subject:mine -- --repo owner/name [--limit 60]` | `scripts/subject/mine.mts` | GitHub |
| 題材候補の順位 | `npm run subject:rank -- --in docs/eval/subject-candidates/x.jsonl` | `scripts/subject/rank.mts` | Jev 1回/候補 |

> `docs/eval/subject-candidates/` は採掘した外部イシューの本文（第三者のメールアドレスを含む）なので Git に入れない。`subject:mine` で再生成する。
| 自然言語リント（全体） | `npm run lint:jev:check` | jev-lint, `rules/` | Jev 約40回, $0.007 |
| 差分だけ | `npm run lint:jev:review`（`--base master`） | 同上 | 数回 |
| ルールの回帰（無料） | `npm run lint:jev:replay` | baseline.json | なし |
| 任意の jev-lint | `npm run lint:jev -- <args>` | `scripts/harness/jev-lint.mts` | — |

## 3. 5本のハーネスと、それぞれが答える問い

| ハーネス | 答える問い | 元になった観点 |
| --- | --- | --- |
| 固定戦略ボット | 理解せずに通る方策があるか（早漏者・詰め込み屋・列挙者 vs 理解者・報告者） | stress-testing: dominant simple policy / agency collapse |
| 帳面レポート | 人はどこで核心に触れ、どこで離脱するか（核心接近曲線） | journey §8 の観察点を数値化 |
| 題材検査 | 題材は謎として成立しているか（真相が通る / 期待が最小対を割る / 原因を言わない / 質問が出る） | reality-check: 中心の約束の検証 |
| jev-lint | 設計の不可侵ルールが文書・コードで守られているか（下表） | decisions 付録A の T 軸。落とした A案・D案がハーネスとして戻った |
| journey-check スキル | 上の記録を証拠として、企画のどこが欠陥・情報不足・試遊待ちか | reality-check + stress-test の固定手順 |

### jev-lint のルール

| ルール | 対象 | ask（要旨） | at | 状態 |
| --- | --- | --- | --- | --- |
| `jev-question-single-condition` | `instructions:` を持つ問いのオブジェクト | 1問に2判断を抱き合わせていないか（注文APIで踏んだ失敗） | 0.62 | fixtures 12 / P1 R1 / 余裕 0.05（`rule` 軸が残余） |
| `llm-never-judges` | 関数すべて | LLM の出力が verdict / cleared / 次の事例 / 予想に流れていないか | 0.60 | fixtures 9 / P1 R1 / clean 上端 0.28 |
| `companion-does-not-leak` | `companion` / `note` / `fallback` / ヒント配列 | 台詞が仕組みや未提示の結果を言っていないか（実行時検問 `spoiler` と同じ命題） | 0.50 | fixtures 13 / P1 R1 / clean 上端 0.34 |
| `claim-has-evidence` | Markdown の節（見出しで分割） | 体験の主張に観測・計測・出典があるか | 0.40 | fixtures 8 / P1 R1（calibrate --labels）/ baseline なし（下記） |
| `commit-message-describes-diff` | コミット | メッセージは diff を正しく言っているか | 0.65 | 同梱ルールの写し。作者の corpus で fit |

ルールを直す手順は `jev-lint` スキルどおり: `rules` で読み込み確認 → `check <fixtures> --dry-run --show-subjects` で matcher が当たっているか → `eval <dir> --repeat 2` → gap を読む（`rewrite` なら subject/state を疑う。閾値をいじらない）→ `--accept`。ラベルは `expect.yml` に理由付きで置き、fixture 本文にマーカーを書かない。

## 4. 2026-09-20 の初回結果（詳細は docs/eval/）

| 記録 | 要点 |
| --- | --- |
| `stress-2026-09-20.md` | 詰め込み屋 3手 6/7、列挙者 6手 5/7、**理解者（台本）5手 6/7 でクリアせず**、報告者の期待は L5/L6 とも undetermined。早漏者 2/7 |
| `subject-check-lru-cache-2026-09-20.md` | 矛盾の2行は原因を言わず（0.12）矛盾として読め（0.86）、LLM から質問3つが出た。**真相の一文は L6 が undetermined**（types 0.36）。報告者の期待も undetermined |
| `notebook-2026-09-20.md` | 11 セッション（Playwright 中心）、核心に触れた 6、提出 2、クリア 0 |
| `jev-lint-2026-09-20.md` | 相棒の台詞 L4/L7 が漏れ（0.64 / 0.60）、L2 が境界（0.49）。体験主張に観測がない節: journey 7・concept 5。LLM 判定の混入なし。注文APIの二重条件の問いは matcher の限界で拾えず（H-09） |
| `jev-lint-2026-09-20-rerun.md` | winget 版 ast-grep 経由で再実行。L2/L4/L7 の書き換え後は companion 行 8 件が 3 パスとも loose 床 0.25 未満（F-03 消えた）。`orders/page.tsx:36` が 0.53〜0.55 → 0.64 と cutoff をまたいで揺れる（ダミー、据え置き） |
| `support-probe-2026-09-20.md` | 行動シグナル 9 件の固定セットを実 Jev に読ませた。Choice 単体は「打っている最中」を stuck、「読み進め中」を explore と読むが、Noul「止まっているか」の門（0.6）と explore の60秒待ちで、出す／出さないは 9/9 が想定どおり。人の行動での分布は未測定 |
| `subject-rank-2026-09-20-notes.md` | `subject:mine` / `subject:rank` の初回実走（cpython 40 件）。対照の bpo-39554（#83735）が 0.74 で全候補の上。既定クエリは性能・環境系が集まり、`not a bug` 系は `completed` で閉じるので拾えない → クエリ案を記録 |

読み方: ボットと題材検査が同じ1点（`types` 軸が 0.4 未満に落ちて L6 が「解釈の確認」になる）を別の方向から指している。これが F-01。直す前に、T-31 の [合ってる] で通るのか、基準文で通すのかを決める。

## 5. 既知の制限

- **Windows**: jev-lint 0.3.2 は `@ast-grep/cli/ast-grep`（拡張子なし）を execFile して失敗し、TypeScript ルールが全部「ast-grep rejected the rule set」で落ちる。`scripts/harness/jev-lint.mts` が `JEV_LINT_AST_GREP` に exe を渡して回避する（優先順: PATH の `ast-grep.exe`（winget 版、2026-09-20 に導入）→ `node_modules/@ast-grep/cli-win32-x64-msvc` → npx キャッシュ）。`npx jev-lint` 直叩きは使わない
- **Windows**: block ルール（Markdown）の `expect.yml` ラベルが突き合わない（subject のパスが `/`、ラベル側が `\`）。`claim-has-evidence` は `calibrate --labels rules/text/claim-has-evidence/labels.json` で fit し、記録を `docs/eval/jev-lint-claim-has-evidence-calibrate.json` に置いた。baseline がないので `eval --replay` の回帰対象に入らない
- **Windows**: `eval --replay` は baseline のラベルも突き合わせられず、P/R 欄が `no labeled violations matched` になる。ゲートとして効くのは各 suite の末尾の `vs the decisions accepted with it: same decisions` の行（決定が動いたかどうか）。live の `eval`（`--repeat`）ではラベルは合う
- **大きなコミット**: `commits` は diff を 64K トークンに切り詰めるが、統合コミット（aa2d9d3・40374a7）は `max_tokens_exceeded` で判定不能。普通の大きさのコミット（af851e4）は通る
- **ボットは人の代わりではない**: 示せるのは「攻略できるか」だけ。曲線と離脱点は人の帳面でしか出ない
- **subject:check は lru に結線**: 軸・事例・照合が `src/subject/lru.ts` 固定。題材が増えたら共通スキーマ（T-60）に合わせて分岐を足す
- `jev-question-single-condition` は問いの文が別 Record に分かれていると判定できない（`src/lib/jev.ts`）。文をインラインに置く規約にするか、matcher を Record 単位にする

## 6. 追加したいもの（backlog H-07〜）

- codex 対照群の手順書。ゲームが勝つべき指標は「終了後に規則を一文で言えるか」
- 未提示事例（holdout）を1枚。クリア後に予想だけ書かせる。転移の測定と締めの演出が一致する
