// 固定戦略ボット（stress-testing-game-concepts の「単純方策で攻略できるか」を自動化）。
// サーバーを立てず、src/lib を直接呼ぶ。読み取りは実 Jev。LLM は呼ばない。
// 使い方: npm run harness:stress  → docs/eval/stress-<date>.md と .json
//
// 測るもの: 各ボットの手数・質問数・核心（1個特例）に触れた手・最終一致・クリア。
// 判定の規則:
//   - 詰め込み屋が理解者以下の手数でクリアする → クリア条件は網羅で通る（理解を測っていない）
//   - 列挙者（質問の答えを繋いだ文）がクリアしない → 繋ぎ文が読めていないか、繋ぎが真でない
//   - 報告者の期待が最小対 L5/L6 を割らない → 題材の矛盾が仮説の形で出ていない
import { mkdirSync, writeFileSync } from "node:fs";
import { readLruInput } from "../../src/lib/lru-input.ts";
import { LRU_AXES, LRU_CASES, type LruAxis, type LruReading } from "../../src/subject/lru.ts";
import { judgeLru, nextLru } from "../../src/lib/lru-select.ts";
import { answerQuestion, QUESTION_TOPICS } from "../../src/subject/lru-questions.ts";
import { reviewCheck } from "../../src/lib/review.ts";
import type { NotebookEntry } from "../../src/lib/notebook-types.ts";

type Bot = { name: string; strategy: string; moves: string[] };
const BOTS: Bot[] = [
  { name: "早漏者", strategy: "最初の一文をそのまま提出する", moves: ["同じ引数で呼べば記憶を返す"] },
  { name: "詰め込み屋", strategy: "観察せず、名前を知っている条件を全部盛る", moves: [
    "引数の値と書き方と順番と型まで同じなら記憶を返す",
    "引数の値と書き方と順番と型まで同じなら記憶を返す。typed=Trueなら型も区別する",
    "引数の値と書き方と順番まで同じなら記憶を返す。ただしintかstrが1個だけなら値そのものを鍵にする。typed=Trueなら型も区別する",
  ] },
  { name: "列挙者", strategy: "全話題を質問してから、答えを繋いだ文を提出する", moves: [
    QUESTION_TOPICS.form.question, QUESTION_TOPICS.order.question, QUESTION_TOPICS.types.question, QUESTION_TOPICS.arity.question, QUESTION_TOPICS.typed.question,
    "書き方と順番を区別する。1と1.0は引数が1個なら別、2個なら同じ。typed=Trueでは型も区別する",
  ] },
  { name: "理解者", strategy: "journey.md §4 の4手＋typed を足す", moves: [
    "同じ引数で呼べば記憶を返す",
    "引数の書き方まで同じなら計算しない",
    "同じ引数で呼べば記憶を返す。ただし型が違えば別",
    "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら値自体が鍵",
    "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら値自体が鍵。typed=Trueでは型も区別する",
  ] },
  { name: "報告者", strategy: "bpo-39554 の報告者の期待をそのまま書く", moves: ["typed=Falseなら1と1.0は同じ呼び出しとして記憶を返す"] },
];
const PAIR = ["L5", "L6"];
const axes = Object.keys(LRU_AXES) as LruAxis[];
const named = (r: LruReading) => axes.filter((a) => r[a] >= 0.6);

type Move = { move: number; kind: string; text: string; ms: number; topic?: string; answer?: string; cases?: string[]; named?: string[]; next?: string; verdict?: string; matches?: number; pair?: string[] };
type Summary = { name: string; strategy: string; moves: number; questions: number; hypotheses: number; coreMove: number | null; shown: number; matches: number; stage: string; cleared: boolean; ms: number; log: Move[] };

async function play(bot: Bot): Promise<Summary> {
  const shown = new Set(["L1"]);
  const entries: NotebookEntry[] = [];
  const log: Move[] = [];
  let lastReading: LruReading | null = null;
  let coreMove: number | null = null;
  let questions = 0, hypotheses = 0, ms = 0;
  for (const [i, text] of bot.moves.entries()) {
    const start = performance.now();
    const input = await readLruInput(text);
    const took = Math.round(performance.now() - start);
    ms += took;
    const base = { id: `${bot.name}-${i + 1}`, at: new Date().toISOString(), hypothesis: text, kind: input.kind, interpretation: input };
    if (input.kind === "question") {
      questions++;
      const q = answerQuestion(input.topic);
      q.cases.forEach((c) => shown.add(c));
      if (q.core && coreMove === null) coreMove = i + 1;
      entries.push({ ...base, answer: q.answer, cases: q.cases, question: q });
      log.push({ move: i + 1, kind: "question", text, ms: took, topic: input.topic, answer: q.answer, cases: q.cases });
    } else {
      hypotheses++;
      lastReading = input.reading;
      const results = LRU_CASES.map((c) => judgeLru(c, input.reading));
      const next = nextLru(results, shown);
      if (next) shown.add(next.id);
      if (input.reading.singleFast >= 0.6 && coreMove === null) coreMove = i + 1;
      entries.push({ ...base, answer: next?.verdict ?? "終了", cases: next ? [next.id] : [], results });
      log.push({ move: i + 1, kind: input.kind, text, ms: took, named: named(input.reading), next: next?.id, verdict: next?.verdict,
        matches: results.filter((r) => r.verdict === "match").length, pair: PAIR.map((id) => `${id}:${results.find((r) => r.id === id)!.verdict}`) });
    }
  }
  const review = reviewCheck(lastReading, entries);
  return { name: bot.name, strategy: bot.strategy, moves: bot.moves.length, questions, hypotheses, coreMove, shown: shown.size,
    matches: review.results.filter((r) => r.verdict === "match").length, stage: review.stage, cleared: review.cleared, ms, log };
}

const summaries: Summary[] = [];
for (const bot of BOTS) {
  const s = await play(bot);
  summaries.push(s);
  console.log(JSON.stringify({ bot: s.name, moves: s.moves, coreMove: s.coreMove, matches: s.matches, cleared: s.cleared, ms: s.ms }));
}
const by = (name: string) => summaries.find((s) => s.name === name)!;
const verdicts: string[] = [];
const stuffer = by("詰め込み屋"), understander = by("理解者"), enumerator = by("列挙者"), reporter = by("報告者"), rusher = by("早漏者");
verdicts.push(stuffer.cleared && stuffer.moves <= understander.moves
  ? `✗ 詰め込み屋が ${stuffer.moves} 手でクリア（理解者 ${understander.moves} 手）。クリア条件は条件の網羅で通る。`
  : stuffer.cleared ? `△ 詰め込み屋は ${stuffer.moves} 手でクリア（理解者 ${understander.moves} 手）。網羅でも届くが理解者より遅い。` : `○ 詰め込み屋は ${stuffer.moves} 手でクリアしない（一致 ${stuffer.matches}/7）。`);
verdicts.push(enumerator.cleared ? `✗ 列挙者は質問の答えを繋いだ文でクリアした（${enumerator.moves} 手）。` : `△ 列挙者の繋ぎ文はクリアしない（一致 ${enumerator.matches}/7、読めた軸: ${enumerator.log.at(-1)?.named?.join("/") || "なし"}）。繋ぎが真でないか、読み取りが落ちている。`);
const pair = reporter.log[0]?.pair ?? [];
verdicts.push(pair.some((p) => p.endsWith("mismatch")) && pair.some((p) => p.endsWith("match")) ? `○ 報告者の期待は L5/L6 を割る（${pair.join(", ")}）。矛盾が仮説の形で出ている。` : `✗ 報告者の期待は L5/L6 を割らない（${pair.join(", ")}）。`);
verdicts.push(understander.cleared ? `○ 理解者は ${understander.moves} 手でクリア。核心到達は手 ${understander.coreMove}。` : `✗ 理解者（台本どおり）がクリアしない（一致 ${understander.matches}/7）。台本か読み取りが壊れている。`);
verdicts.push(rusher.cleared ? `✗ 早漏者が1手でクリア。` : `○ 早漏者は1手ではクリアしない（一致 ${rusher.matches}/7、段階: ${rusher.stage}）。`);

const date = new Date().toISOString().slice(0, 10);
const md = [`# 固定戦略ボット ${date}`, "", "`npm run harness:stress`（実 Jev、LLM なし）。判定の規則はスクリプト冒頭。", "",
  "| ボット | 戦略 | 手数 | 質問 | 仮説 | 核心到達手 | 見た事例 | 一致 | 段階 | クリア | Jev ms |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...summaries.map((s) => `| ${s.name} | ${s.strategy} | ${s.moves} | ${s.questions} | ${s.hypotheses} | ${s.coreMove ?? "—"} | ${s.shown} | ${s.matches}/7 | ${s.stage} | ${s.cleared ? "✓" : "—"} | ${s.ms} |`),
  "", "## 判定", "", ...verdicts.map((v) => `- ${v}`), "", "## 手ごとの記録", ""];
for (const s of summaries) {
  md.push(`### ${s.name}`, "", "| 手 | 種別 | 入力 | 読み | 次 / 答え | 一致 | L5/L6 | ms |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const m of s.log) md.push(`| ${m.move} | ${m.kind} | ${m.text} | ${m.kind === "question" ? m.topic : (m.named?.join("/") || "なし")} | ${m.kind === "question" ? `${m.answer} ${m.cases?.join("+")}` : `${m.next ?? "終了"} ${m.verdict ?? ""}`} | ${m.matches ?? "—"} | ${m.pair?.join(" ") ?? "—"} | ${m.ms} |`);
  md.push("");
}
mkdirSync("docs/eval", { recursive: true });
writeFileSync(`docs/eval/stress-${date}.md`, md.join("\n"));
writeFileSync(`docs/eval/stress-${date}.json`, JSON.stringify({ date, summaries }, null, 1));
console.log(verdicts.join("\n"));
console.log(`→ docs/eval/stress-${date}.md`);
if (verdicts.some((v) => v.startsWith("✗"))) process.exitCode = 1;
