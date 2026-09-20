# jev-lint 2026-09-20 再実行 — winget 版 ast-grep 経由、相棒台詞の書き換え後

ユーザーが `ast-grep` 0.45.3（winget）と `gh` 2.101 を入れた後の再測定。ラッパー `scripts/harness/jev-lint.mts` は PATH の `ast-grep.exe` を最優先で `JEV_LINT_AST_GREP` に渡すよう変更（次点 node_modules、npx キャッシュ）。`rules` で 5 本読み込み・エラー 0 を確認。

## `npm run lint:jev:check`（170 subjects、36 requests、$0.0069）

| ルール | 場所 | 値 | 前回（jev-lint-2026-09-20.md）との差 |
| --- | --- | --- | --- |
| companion-does-not-leak | `src/subject/lru.ts` | 検出なし | 前回 L4 0.64 / L7 0.60 / L2 0.49。**他セッションが L2/L4/L7 を疑問形に書き換えた後の値**（F-03） |
| companion-does-not-leak | `src/subject/cases.ts:91, 104` | 0.83 / 0.86 | 変わらず（注文API ダミー、据え置き） |
| llm-never-judges | `src/app/orders/page.tsx:36` | 0.64（flag） | 前回は loose 帯 0.53〜0.55。**cutoff 0.60 をまたいで揺れる**。ダミー画面の UI 状態遷移で LLM は関与しない。据え置き、ラベルを足すなら fixture へ |
| claim-has-evidence | journey.md 17, 34, 161, 166, 239, 245, 315 | 0.43〜0.82 | 前回 7 節と同じ（行番号は §0b/§10 追加でずれた） |
| claim-has-evidence | concept.md 8, 19, 29, 37, 179, 257 | — | 前回 5 節 + 257（§12 末尾の追記。仮定と明記済みだが「観測なし」は事実） |
| jev-question-single-condition | — | 検出なし | 変わらず。`src/subject/lru.ts:46, 49` が loose 帯 0.42 / 0.33 |

## 相棒台詞の安定性（`check src/subject/lru.ts --retry 3 --loose 6 --force`）

companion 行 8 件（17〜23, 36）は 3 パスの平均で cutoff 0.50 はもちろん loose 床 0.25 も下回った。書き換え後の台詞に漏れの兆候はない。書き換え前の値（0.64 / 0.60 / 0.49）が単発の揺れだったか本当の差かは、前の文で `--retry 3` を取っていないので言えない。

## 読み方

- F-03 は書き換えで lint 上は消えた。人が読んで「比較を指しているか」を確認するのは別
- `orders/page.tsx:36` のように cutoff 付近で揺れる subject は、`--retry 3` の平均で見る。1 回の値で直す・直さないを決めない
