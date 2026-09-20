---
name: subject-forge
description: "仮説クエストの題材（subject）を新しく作る、または既存題材を検査する手順。実 OSS の not-a-bug イシューから候補を集め、Jev で順位付けし、最小対を実行で確定し、docs/subjects/<name>.md を書き、機械検査（subject:check）と jev-lint を通す。トリガー: 題材を足したい、この MR/イシューを題材にできるか、subject:mine / subject:rank / subject:check、docs/subjects/ の編集。"
---

# subject-forge — 題材を作る

よい題材の条件は3つ。**自然な期待が外れる最小対がある**（2つの入力が1点だけ違い、結果が逆になる）。**真相が一文と数行のコードに収まる**。**報告者と作者が実際に対立した**（not a bug / wontfix で閉じ、メンテナが理由を書いた）。3つ目の候補は GitHub 上でほぼ「reason: not planned で閉じられ、コメントが付いたイシュー」に集まっている。

原則: 測ることはスクリプト、読んで決めることは人（またはこのスキルを使うエージェント）。結果はすべて実行で得る。LLM は言い換えと質問生成にしか使わない。

## 手順

1. **候補を集める** `npm run subject:mine -- --repo owner/name [--limit 60]`
   - 既定の検索は `is:issue is:closed reason:"not planned" comments:>=2`。`--query` で変えられる
   - 未認証は検索 10 回/分・本体 60 回/時。`GITHUB_TOKEN` を `.dev.vars` に置けば 5000 回/時
   - 出力 `docs/eval/subject-candidates/<owner>-<repo>.jsonl`
2. **Jev で順位付け** `npm run subject:rank -- --in docs/eval/subject-candidates/<owner>-<repo>.jsonl`
   - 4命題（期待が具体的 / 返答が「意図どおり」 / 入力の条件で説明 / 最小対が本文にある）を 1候補 1リクエストで読む。点は順位として読み、上位 5〜10 件を人が読む
   - 命題を足すときは1問1判断にする。`rules/typescript/jev-question-single-condition` が検査する
3. **上位候補を読んで最小対を設計する**（人の仕事）
   - 報告者の期待をそのまま「仮説」として書き下す。真相をメンテナの返答から一文で書く
   - 1点だけ違う入力の組を 5〜8 枚。矛盾の2行（最も驚く対）を決める。docs/subjects/lru-cache.md §3〜§5 が見本
4. **実行で結果を確定する**。Python なら `wsl.exe python3`（Windows の python は Store スタブ）。`scripts/verify-lru.py` の形（カードごとに新しい状態から実行）を写す。結果を推論で書かない
5. **spec を書く** `scripts/subject/specs/<name>.json`（paradox / paradoxCases / reporterExpectation / truth）。`check.mts` は今は lru の軸・事例に結線されているので、題材が増えたら共通スキーマ（backlog T-60）に合わせて分岐を足す
6. **機械検査** `npm run subject:check -- --spec scripts/subject/specs/<name>.json`
   - truth-passes-all: 真相の一文が全事例に一致（読み取り＋コードの照合）
   - expectation-splits-pair: 報告者の期待が最小対を割る（片方一致・片方食い違い）
   - paradox-hides-cause / paradox-reads-as-puzzle: 矛盾の2行が原因を言わず、矛盾として読める（Jev）
   - paradox-provokes-questions: 2行だけ見せて質問が出る（LLM。出なければ UI では救えない）
7. **文書を書く** `docs/subjects/<name>.md`。§1 なぜ / §2 世界 / §3 事例表（実測） / §4 仮説の壊れ方 / §5 出典イシュー（3年以上前・引用） / §7 未探索 / §8 戻り先コード / §9 検証スクリプト
8. **リント** `npm run lint:jev -- check docs/subjects/<name>.md src/subject/<name>.ts`。相棒の台詞が漏れていないか（companion-does-not-leak）、体験の主張に観測があるか（claim-has-evidence）
9. **reality check**: `game-design-reality-check` スキルの Quick Reality Check を題材に当てる。中心の約束（矛盾）、最大の仮定3つ、最初に壊れそうな点、次の試験。結果は `docs/eval/subject-check-<name>-<date>.md` の末尾に追記

## 判断の基準

| 落とす | 理由 |
| --- | --- |
| 最小対が作れない（差が2点以上） | 質問で絞れない。ウミガメにならない |
| 真相が環境・バージョン依存 | 事例が固定できない（packaging の例、lru-cache.md §10） |
| 返答が「直す」 | 期待と実装の対立がない。矛盾が解消済み |
| 矛盾の2行で質問が出ない | 謎になっていない。UI で救えない |

## 関連

- 現題材: [docs/subjects/lru-cache.md](../../../docs/subjects/lru-cache.md)、検査記録 `docs/eval/subject-check-lru-cache-*.md`
- ハーネス全体: [docs/harness.md](../../../docs/harness.md)
- 体験側の批評: `journey-check` スキル
