// 題材候補の順位付け: mine.mts の jsonl を Jev（Noul 4本、1候補1リクエスト）で読む。
// 使い方: npm run subject:rank -- --in docs/eval/subject-candidates/python-cpython.jsonl [--top 20] [--concurrency 4]
// 出力: <in>.ranked.jsonl（各候補に scores を付加）と docs/eval/subject-rank-<name>-<date>.md
//
// 命題（すべて単文・1問1判断。rules/typescript/jev-question-single-condition の対象）:
//   expectation  報告は「こうなるはず」という具体的な期待を書いているか
//   intended     返答は、その挙動が意図したものだと言っているか
//   condition    返答は、入力の特定の条件（個数・型・書き方・順番・大きさ）で挙動を説明しているか
//   minimalPair  1点だけ違う2つの入力が、違う挙動をする例が本文か返答にあるか
// 点は幾何平均。閾値ではなく順位として読む（上位を人が読む）。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateState, parseNoul } from "../../src/lib/noul.ts";

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const input = arg("--in");
if (!input) { console.error("--in <jsonl> が必要"); process.exit(2); }
const top = Number(arg("--top", "20"));
const concurrency = Number(arg("--concurrency", "4"));
type Candidate = { number: number; title: string; url: string; created_at: string; state_reason: string; body: string; comments: { author: string; association: string; body: string }[]; scores?: Record<string, number>; score?: number; ms?: number };
const candidates: Candidate[] = readFileSync(input, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const QUESTIONS = {
  expectation: { type: "noul", instructions: "Does `report` state a concrete behaviour the reporter expected, which differs from what the software actually did?", criteria: { true: "A specific expected result (a value, a hit, an error, an order) is stated and contrasted with the actual result.", false: "Only a crash, a question, a feature wish, or a vague complaint; no expected-versus-actual contrast." } },
  intended: { type: "noul", instructions: "Do the `replies` say that the reported behaviour is intended, by design, or working as documented?", criteria: { true: "A reply defends the current behaviour as intended, documented, or a deliberate trade-off.", false: "Replies accept it as a bug, ask for more information, defer, or say nothing about intent." } },
  condition: { type: "noul", instructions: "Do the `replies` explain the behaviour through a specific property of the input, such as its count, type, form, order, or size?", criteria: { true: "The explanation names an input property that flips the behaviour (one argument versus two, int versus float, keyword order, empty versus non-empty).", false: "The explanation is about environment, version, platform, timing, or gives no mechanism." } },
  minimalPair: { type: "noul", instructions: "Does `report` or `replies` contain two concrete inputs or calls that differ in one respect and behave differently?", criteria: { true: "Two side-by-side examples are given, nearly identical, with different outcomes.", false: "Only one example, or examples that differ in many ways, or no concrete example." } },
} as const;
const keys = Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[];

async function score(c: Candidate) {
  const start = performance.now();
  const replies = c.comments.filter((x) => ["OWNER", "MEMBER", "COLLABORATOR", "CONTRIBUTOR"].includes(x.association)).map((x) => x.body).join("\n---\n") || c.comments.map((x) => x.body).join("\n---\n");
  const data = await evaluateState({ title: c.title, report: c.body.slice(0, 5000), replies: replies.slice(0, 6000) }, QUESTIONS);
  c.scores = parseNoul(data, keys);
  c.score = Math.pow(keys.reduce((p, k) => p * Math.max(0.01, c.scores![k]), 1), 1 / keys.length);
  c.ms = Math.round(performance.now() - start);
}
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < candidates.length) {
    const c = candidates[cursor++];
    try { await score(c); console.error(`#${c.number} ${c.score!.toFixed(2)} ${c.title}`); } catch (e) { console.error(`#${c.number} 失敗: ${(e as Error).message}`); }
  }
}));
const ranked = candidates.filter((c) => c.score !== undefined).sort((a, b) => b.score! - a.score!);
writeFileSync(input.replace(/\.jsonl$/, "") + ".ranked.jsonl", ranked.map((c) => JSON.stringify(c)).join("\n") + "\n");
const date = new Date().toISOString().slice(0, 10);
const name = input.split("/").pop()!.replace(/\.jsonl$/, "");
const md = [`# 題材候補の順位 ${name} ${date}`, "", `${ranked.length} 件を Jev で読んだ（4命題、幾何平均）。上位を人が読み、subject-forge の手順で最小対を作る。`, "",
  "| # | 点 | 期待 | 意図 | 条件 | 最小対 | 起票 | 題名 |", "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...ranked.slice(0, top).map((c) => `| [#${c.number}](${c.url}) | ${c.score!.toFixed(2)} | ${c.scores!.expectation.toFixed(2)} | ${c.scores!.intended.toFixed(2)} | ${c.scores!.condition.toFixed(2)} | ${c.scores!.minimalPair.toFixed(2)} | ${c.created_at.slice(0, 7)} | ${c.title.replace(/\|/g, "\\|")} |`), ""];
mkdirSync("docs/eval", { recursive: true });
writeFileSync(`docs/eval/subject-rank-${name}-${date}.md`, md.join("\n"));
console.log(md.join("\n"));
