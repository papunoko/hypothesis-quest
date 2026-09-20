---
name: journey-check
description: "仮説クエストの体験（docs/journey.md・concept.md §12・実装）を批判的に検討する固定手順。docs/eval/ の最新記録（固定戦略ボット・帳面レポート・題材検査・jev-lint）を入力に、game-design-reality-check と stress-testing-game-concepts の問いを当て、欠陥 / 情報不足 / 試遊が必要 に分けて返す。トリガー: ジャーニーは面白いか、体験を見直したい、journey.md を変えた、企画の批評、次に何を試すべきか。"
---

# journey-check — 体験を批評する

「面白いか」を直接は答えない（stress-testing の方針）。答えるのは、**仮説を試すことで理解が進む**という中心の主張が、いまの記録で支持されているか、固定戦略で形骸化していないか、次に何を測れば判断が変わるか。

## 入力（読む順）

1. `docs/eval/stress-<最新>.md` — 固定戦略ボット。無ければ `npm run harness:stress` を先に回す（実 Jev、20 秒程度）
2. `docs/eval/notebook-<最新>.md` — 帳面。人の試遊があれば核心接近曲線と離脱点がここに出る。Playwright のセッションが混じるので時刻で見分ける
3. `docs/eval/subject-check-<題材>-<最新>.md` — 題材が謎として成立しているか
4. `npm run lint:jev:check` の `claim-has-evidence` の findings — journey/concept のどの節が観測なしの体験主張か
5. `docs/journey.md`、`docs/concept.md` §12、`docs/backlog.md` の H / F 節

## 当てる問い（固定）

### A. reality-check（`game-design-reality-check` の Core Process）

1. 中心の主張を仮説の形に直す: 「[誰]が[状況]で[仕組み]により[行動]し、[体験]になる」
2. 因果の鎖: 謎 → 質問/仮説 → 答え（最小対）→ 気づき → 一文 → レビュー判定。矢印ごとに、その矢印を支える記録があるか
3. 証拠のラベル: 観測 / 出典 / 推論 / 仮定 / 不明。claim-has-evidence の findings をそのまま台帳の行にする
4. いちばん弱い仮定と、それを確かめる最小の試遊

### B. stress-test（`stress-testing-game-concepts` の Workflow 4〜6）

1. 単純方策: 早漏者・詰め込み屋・列挙者の結果を読む。理解者と同じ手数で通る方策があれば **agency collapse** として記録
2. 鍵となる判断: 「違う行動を選ぶべき到達可能な状況を2つ示せるか」。示せなければ、選択は言葉の違いだけで判断の余地がない
3. 報酬の抜け道: 軸の名前を全部言えば通るか。鏡・ヒント・相棒の台詞が答えを漏らしていないか（companion-does-not-leak）
4. 到達不能: 理解者（台本）がクリアしないなら、目標が到達不能。読み取りの問題（F-01）か台本の問題かを切り分ける

### C. codex 対照（backlog H-07）

同じ PR を普通のチャットで解いた群と比べる記録があるか。無ければ「不明」とし、次の試験に入れる。ゲームが勝つべき指標は所要時間ではなく、終了後に規則を一文で言えるか。

## 出力

`docs/eval/journey-check-<date>.md` に書く。形式は固定:

```
# journey-check <date>
入力: stress-<date>, notebook-<date>, subject-check-<...>, lint findings N件

## 判定（1行）と最強の理由
## 欠陥（記録で示せる）      … 各項目に根拠の記録名と行
## 情報不足（記録が無い）    … 何が無いか、どう取るか
## 試遊が必要（人でしか分からない）… 観察点（journey §8）と決定の閾値
## 次の判別試験（1つ）       … 最小の試験、成功/失敗の基準、判断がどう変わるか
```

判定の語彙は reality-check のもの: Unexamined / Plausible but unproven / Test-ready / Provisionally supported / Contradicted。hard reject は stress-test の基準（到達不能・単純方策が支配・選択の形骸化）を記録で示せたときだけ。

## してはいけないこと

- LLM の「面白そう」を証拠にしない。証拠は方策名・トレース・帳面の行・イシュー
- 批評を新しいアイデアで埋めない。修正案は「最小のルール変更」を1つ、失敗トレースを残したうえで
- ボットの結果を人の試遊の代わりにしない。ボットが示せるのは「攻略できるか」だけ

## 関連

- 全体: [docs/harness.md](../../../docs/harness.md)
- 題材側: `subject-forge` スキル
- 前回の批評（対話ログの要約）: backlog F-01〜F-05
