// 題材の機械検査（subject-forge スキルの最終段）。
// 使い方: npm run subject:check [-- --spec scripts/subject/specs/lru-cache.json]
//
// 1. 真相の一文（truth）を Jev で読み、7事例すべてに一致するか（コード側の judge）
// 2. 報告者の期待（reporterExpectation）が最小対（paradoxCases）を割るか
//    — 片方は一致・片方は食い違い、になっていれば「自然な期待が外れる矛盾」が仮説の形で出ている
// 3. 矛盾の2行（paradox）が、原因を言っていないか（Jev Noul）／矛盾として読めるか（Jev Noul）
// 4. 矛盾の2行だけを LLM に見せて、質問が出るか（OLLAMA_API_KEY が無ければ省略）
// どれか落ちれば終了コード1。記録は docs/eval/subject-check-<subject>-<date>.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateState, parseNoul, readNoul } from "../../src/lib/noul.ts";
import { LRU_AXES, LRU_CASES } from "../../src/subject/lru.ts";
import { judgeLru } from "../../src/lib/lru-select.ts";

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const spec = JSON.parse(readFileSync(arg("--spec", "scripts/subject/specs/lru-cache.json"), "utf8")) as {
  subject: string; scope: string; paradox: string[]; paradoxCases: string[]; reporterExpectation: string; truth: string;
};
const checks: { id: string; ok: boolean; detail: string }[] = [];

// 1. 真相
const truthReading = await readNoul(spec.truth, LRU_AXES);
const truthResults = LRU_CASES.map((c) => judgeLru(c, truthReading));
const truthMiss = truthResults.filter((r) => r.verdict !== "match").map((r) => `${r.id}:${r.verdict}`);
checks.push({ id: "truth-passes-all", ok: truthMiss.length === 0, detail: truthMiss.length ? `一致しない: ${truthMiss.join(", ")} / 読み: ${JSON.stringify(truthReading)}` : `7/7 一致 / 読み: ${JSON.stringify(truthReading)}` });

// 2. 報告者の期待が最小対を割る
const expReading = await readNoul(spec.reporterExpectation, LRU_AXES);
const expResults = LRU_CASES.map((c) => judgeLru(c, expReading));
const pair = spec.paradoxCases.map((id) => `${id}:${expResults.find((r) => r.id === id)!.verdict}`);
const splits = pair.some((p) => p.endsWith(":mismatch")) && pair.some((p) => p.endsWith(":match"));
checks.push({ id: "expectation-splits-pair", ok: splits, detail: `${pair.join(", ")}（全体の食い違い ${expResults.filter((r) => r.verdict === "mismatch").length}/7）` });

// 3. 矛盾の2行
const paradoxText = `${spec.scope}\n${spec.paradox.join("\n")}`;
const data = await evaluateState({ paradox: paradoxText }, {
  cause: { type: "noul", instructions: "Does `paradox` state or explain WHY the two observations differ (a mechanism, a rule, an internal reason)?", criteria: { true: "Names a cause, a rule, or an internal mechanism that accounts for the difference.", false: "Only reports what happened in each case, with no reason given." } },
  puzzle: { type: "noul", instructions: "Does `paradox` present two observations that a reader would expect to agree but which disagree?", criteria: { true: "The two lines describe closely similar situations with different outcomes, so a reader is left asking why.", false: "The outcomes are unsurprising, unrelated, or trivially explained by the text itself." } },
});
const scores = parseNoul(data, ["cause", "puzzle"]);
checks.push({ id: "paradox-hides-cause", ok: scores.cause < 0.3, detail: `cause=${scores.cause.toFixed(2)}（< 0.30）` });
checks.push({ id: "paradox-reads-as-puzzle", ok: scores.puzzle >= 0.6, detail: `puzzle=${scores.puzzle.toFixed(2)}（≥ 0.60）` });

// 4. 質問が出るか（LLM）
const key = process.env.OLLAMA_API_KEY;
if (key) {
  try {
    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "gemma4:31b", stream: false, think: false, options: { temperature: 0.2, num_predict: 300 }, messages: [
        { role: "system", content: "あなたはこの挙動を初めて見た読者です。答えや原因を推測せず、まず確かめたい疑問だけを日本語の質問文で3つ、1行ずつ書いてください。" },
        { role: "user", content: paradoxText },
      ] }), signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json();
    const text: string = body.message?.content ?? "";
    // 日本語の疑問文は「？」を付けないことが多い（「〜でしょうか。」）。文末表現でも数える
    const questions = text.split("\n").map((s: string) => s.trim()).filter((s: string) => /[?？]|(でしょうか|ですか|ますか|だろうか|のか)[。]?$/.test(s));
    checks.push({ id: "paradox-provokes-questions", ok: questions.length >= 2, detail: questions.length ? questions.join(" / ") : `質問なし: ${text.slice(0, 120)}` });
  } catch (error) { checks.push({ id: "paradox-provokes-questions", ok: false, detail: `LLM 失敗: ${(error as Error).message}` }); }
} else checks.push({ id: "paradox-provokes-questions", ok: true, detail: "省略（OLLAMA_API_KEY なし）" });

const date = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const md = [`# 題材検査 ${spec.subject} ${date}`, "", `矛盾:`, ...spec.paradox.map((p) => `> ${p}`), "", "| 検査 | 結果 | 詳細 |", "| --- | --- | --- |",
  ...checks.map((c) => `| ${c.id} | ${c.ok ? "○" : "✗"} | ${c.detail} |`), ""];
mkdirSync("docs/eval", { recursive: true });
writeFileSync(`docs/eval/subject-check-${spec.subject}-${date}.md`, md.join("\n"));
console.log(md.join("\n"));
if (checks.some((c) => !c.ok)) process.exitCode = 1;
