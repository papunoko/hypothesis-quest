// 帳面（D1 ローカル / 旧 SQLite）からセッション別の「核心接近曲線」と離脱点を出す。
// Jev も LLM も呼ばない。保存済みの読み取り（軸の確率・話題・core）だけを使う。
// 使い方: npm run harness:notebook [-- --db path.sqlite]  → docs/eval/notebook-<date>.md
//
// 曲線の値（0〜1）: 質問は core なら 1.0、それ以外の話題は 0.3、未対応/無関係は 0.1。
//                  仮説は singleFast（1個特例）の読み取り確率。
// 「核心」= 引数の個数で型の扱いが変わるという事実（L5/L6 の最小対）。
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NotebookEntry } from "../../src/lib/notebook-types.ts";
import type { Submission } from "../../src/lib/review.ts";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const paths = arg("--db") ? [arg("--db")!] : [
  ...(existsSync(D1_DIR) ? readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite").map((f) => join(D1_DIR, f)) : []),
  ...(existsSync("data/notebook.sqlite") ? ["data/notebook.sqlite"] : []),
];
const SPARK = "▁▂▃▄▅▆▇█";
const spark = (values: number[]) => values.map((v) => SPARK[Math.min(7, Math.max(0, Math.round(v * 7)))]).join("");
const level = (e: NotebookEntry) => e.kind === "question" ? (e.question?.core ? 1 : e.question?.topic ? 0.3 : 0.1) : (e.interpretation?.reading?.singleFast ?? 0);
const short = (s: string, n = 28) => s.length > n ? s.slice(0, n) + "…" : s;

type Row = { db: string; session: string; entries: NotebookEntry[]; submissions: Submission[] };
const rows: Row[] = [];
for (const path of paths) {
  const db = new DatabaseSync(path, { readOnly: true });
  const sessions = db.prepare("SELECT session, MIN(seq) AS first FROM notebook GROUP BY session ORDER BY first").all() as { session: string }[];
  for (const { session } of sessions) {
    const entries = (db.prepare("SELECT entry FROM notebook WHERE session = ? ORDER BY seq").all(session) as { entry: string }[]).map((r) => JSON.parse(r.entry) as NotebookEntry);
    let submissions: Submission[] = [];
    try { submissions = (db.prepare("SELECT entry FROM submissions WHERE session = ? ORDER BY seq").all(session) as { entry: string }[]).map((r) => JSON.parse(r.entry) as Submission); } catch {}
    rows.push({ db: path.includes(".wrangler") ? "D1" : path, session, entries, submissions });
  }
}

const date = new Date().toISOString().slice(0, 10);
const total = rows.length;
const withCore = rows.filter((r) => r.entries.some((e) => level(e) >= 0.6)).length;
const submitted = rows.filter((r) => r.submissions.length > 0).length;
const cleared = rows.filter((r) => r.submissions.some((s) => s.cleared)).length;
const md = [`# 帳面レポート ${date}`, "", `対象: ${paths.join(", ") || "（帳面なし）"}`, "",
  "| 指標 | 値 |", "| --- | --- |", `| セッション | ${total} |`, `| 核心に触れた（曲線 ≥ 0.6 の手がある） | ${withCore} |`, `| 提出あり | ${submitted} |`, `| クリア | ${cleared} |`, "",
  "曲線: 質問は core=1.0 / 話題あり=0.3 / 未対応=0.1、仮説は 1個特例の読み取り確率。離脱点 = 最後の入力。", "",
  "| DB | セッション | 手数 | 曲線 | 最初の核心 | 最後の入力（離脱点） | 提出 |", "| --- | --- | --- | --- | --- | --- | --- |"];
for (const r of rows) {
  const levels = r.entries.map(level);
  const first = levels.findIndex((v) => v >= 0.6);
  const last = r.entries.at(-1);
  md.push(`| ${r.db} | ${r.session.slice(0, 8)} | ${r.entries.length} | \`${spark(levels)}\` | ${first >= 0 ? `手${first + 1}` : "—"} | ${last ? `${last.kind}: ${short(last.hypothesis)} → ${last.answer}` : "—"} | ${r.submissions.length ? (r.submissions.some((s) => s.cleared) ? "✓ クリア" : `${r.submissions.length}件 未クリア`) : "—"} |`);
}
md.push("", "## 手ごとの記録", "");
for (const r of rows) {
  md.push(`### ${r.db} ${r.session.slice(0, 8)}`, "", "| 手 | 時刻 | 種別 | 入力 | 話題/軸 | 返答 | 事例 |", "| --- | --- | --- | --- | --- | --- | --- |");
  r.entries.forEach((e, i) => {
    const axesNamed = e.kind === "question" ? `${e.question?.topic ?? "—"}${e.question?.core ? " (core)" : ""}` : Object.entries(e.interpretation?.reading ?? {}).filter(([, v]) => (v as number) >= 0.6).map(([k]) => k).join("/") || "なし";
    md.push(`| ${i + 1} | ${e.at.slice(11, 19)} | ${e.kind} | ${short(e.hypothesis, 40)} | ${axesNamed} | ${e.answer} | ${e.cases.join("+")} |`);
  });
  for (const s of r.submissions) md.push(`| 提出 | ${s.at.slice(11, 19)} | review | ${short(s.hypothesis, 40)} | ${s.decision} | ${s.stage}${s.cleared ? " ✓" : ""} | ${s.results.filter((x) => x.verdict === "match").length}/7 |`);
  md.push("");
}
mkdirSync("docs/eval", { recursive: true });
writeFileSync(`docs/eval/notebook-${date}.md`, md.join("\n"));
console.log(md.slice(0, 12 + rows.length).join("\n"));
console.log(`→ docs/eval/notebook-${date}.md`);
