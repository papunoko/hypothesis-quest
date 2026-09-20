ここはtypesafe jev hackathonのplayground。

tg (tgrep)を使うこと。MS製のインデックス付きgrep。grepは使用しないこと。

## 作業前に読むドキュメント

- まず `docs/HANDOFF.md` を読み、最新の実装状態・未完事項を確認する。古い記録を現在の仕様と取り違えない。
- `README.md` のドキュメント一覧から、作業に関係する `docs/` の文書を読んでから着手する。
- 体験・UI・判定を変更するときは `docs/decisions.md`、`docs/concept.md`、`docs/journey.md`、`docs/backlog.md` を確認する。
- **公開・環境変数・Cloudflare・DB・運用の作業では `docs/deployment.md` を必ず読む。** 現在はWorkers + OpenNext + D1構成であり、過去のTunnel/ローカルSQLite手順をそのまま使わない。
- 公開期限は日本時間2026年9月30日いっぱい。期限・既存DNS・課金APIの制限を確認し、依頼なしに延長・再公開しない。
- 実装や運用が変わったら、関連docsと `docs/HANDOFF.md` も更新する。検証済み・未検証・未公開を区別して記録する。
- 秘密値は `.dev.vars` / Workers Secretsへ置く。キーを表示・コミットしない。OpenNext成果物に埋め込まれる `.env*` へ秘密値を置かない。

## ハーネス（体験と題材を批判的に測る道具）

全体像と使い方は `docs/harness.md`。原則: **測ることはスクリプト、読んで書いて決めることはスキル**。

- **スキル**（`.claude/skills/`、Codex は `.agents/skills/`）: `subject-forge`（題材を作る手順）、`journey-check`（体験を批評する固定の問い）、外部の `jev-lint` / `game-design-reality-check` / `stress-testing-game-concepts`。企画やジャーニーを変える前後で `journey-check` を、題材を足すときは `subject-forge` を使う。
- **自然言語リント** `npm run lint:jev:check`（jev-lint、ルールは `rules/`）。Jev に投げる問いが1問1判断か、LLM の出力が判定に流れていないか、相棒の台詞が答えを漏らしていないか、journey/concept の体験主張に観測があるか。finding は候補であって判定ではない。読んで、コードを直すか、ラベルを足して `rules/*/*/expect.yml` に残す。ルールの文・基準・状態を変えたら `jev-lint eval <dir> --repeat 2 --accept` で baseline を取り直す。
- **固定戦略ボット** `npm run harness:stress`、**帳面レポート** `npm run harness:notebook`、**題材検査** `npm run subject:check`。結果は `docs/eval/` に日付付きで残す（消さない。批評はこの記録を入力にする）。
- Windows では jev-lint の ast-grep 呼び出しが壊れているので、必ず `npm run lint:jev -- <args>`（ラッパー）経由で呼ぶ。ラッパーは PATH の `ast-grep`（winget 版）を優先して渡す。`npx jev-lint` 直叩きは TypeScript ルールが全部落ちる。
- `subject:mine` は `GITHUB_TOKEN="$(gh auth token)"` を前置して呼ぶ（`gh` はログイン済み）。トークンを表示・保存しない。



<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
