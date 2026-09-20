import { evaluateState, parseNoul } from "./noul.ts";
import { CASES, LABEL } from "../subject/cases.ts";

export type Narration = { text: string; source: "generated" | "fallback"; reason?: "unavailable" | "screened" };
type Context = { mode: "question" | "review"; playerText: string; allowedFacts: unknown; fallback: string };
type Result = { id: string; verdict: "match" | "mismatch" | "undetermined" };

async function callModel(system: string, user: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch("https://ollama.com/api/chat", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemma4:31b", stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal,
  });
  if (!response.ok) throw new Error("LLM unavailable");
  const data = await response.json();
  return typeof data.message?.content === "string" ? data.message.content.trim() : "";
}

export async function generateText(context: Context, signal?: AbortSignal): Promise<string> {
  const text = await callModel("事実の唯一の根拠はallowedFacts。出力は本文だけ。", JSON.stringify({ playerText: context.playerText, allowedFacts: context.allowedFacts }), signal);
  if (!text || text.length > 1600) throw new Error("Invalid generated text");
  return text;
}

export async function screenText(context: Context, draft: string, signal?: AbortSignal): Promise<boolean> {
  const data = await evaluateState({ allowedFacts: context.allowedFacts, draft }, {
    unsupported: { type: "noul", instructions: "Does `draft` assert any factual claim not supported by `allowedFacts`?", criteria: { true: "Invents behavior, outcomes, or causes.", false: "Only restates supplied facts." } },
  }, signal);
  return parseNoul(data, ["unsupported"]).unsupported < 0.3;
}

export async function narrate(context: Context, signal?: AbortSignal): Promise<Narration> {
  try {
    const draft = await generateText(context, signal);
    if (!await screenText(context, draft, signal)) return { text: context.fallback, source: "fallback", reason: "screened" };
    return { text: draft, source: "generated" };
  } catch { return { text: context.fallback, source: "fallback", reason: "unavailable" }; }
}

export async function gradeReview(hypothesis: string, results: Result[], signal?: AbortSignal): Promise<{ cleared: boolean; text: string }> {
  const text = await callModel("レビューを採点し、最後の行に PASS か FAIL だけを書く。", JSON.stringify({ hypothesis, results }), signal);
  const cleared = /PASS\s*$/.test(text);
  return { cleared, text };
}

export async function pickNextCase(hypothesis: string, shown: string[], signal?: AbortSignal): Promise<string> {
  const answer = await callModel("次に見せるべき事例IDを1つだけ答える。", JSON.stringify({ hypothesis, shown, cases: CASES.map((c) => c.id) }), signal);
  const id = answer.match(/L[1-8]/)?.[0];
  return id && !shown.includes(id) ? id : CASES.find((c) => !shown.includes(c.id))!.id;
}

export async function predictWithModel(hypothesis: string, caseId: string, signal?: AbortSignal): Promise<Result> {
  const c = CASES.find((x) => x.id === caseId)!;
  const answer = await callModel("仮説を唯一のルールとして2回目の呼び出しの結果を remembered か computed で答える。", JSON.stringify({ hypothesis, calls: c.calls }), signal);
  const prediction = answer.includes("remembered") ? "remembered" : "computed";
  return { id: c.id, verdict: prediction === c.actual ? "match" : "mismatch" };
}

export function summarizeResults(results: Result[]): string {
  const matches = results.filter((r) => r.verdict === "match").length;
  return `${matches}/${results.length} ${LABEL.match}`;
}

export async function explainMismatch(hypothesis: string, result: Result, signal?: AbortSignal): Promise<Narration> {
  if (result.verdict !== "mismatch") return { text: "", source: "fallback" };
  const c = CASES.find((x) => x.id === result.id)!;
  try {
    const text = await callModel("観察だけを言い換える。原因を足さない。", JSON.stringify({ hypothesis, calls: c.calls, observation: c.observation }), signal);
    return { text, source: "generated" };
  } catch { return { text: c.observation, source: "fallback" }; }
}
