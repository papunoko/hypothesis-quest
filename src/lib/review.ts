import { LRU_CASES, LRU_LABEL, type LruReading } from "../subject/lru.ts";
import { QUESTION_TOPICS } from "../subject/lru-questions.ts";
import { judgeLru, type LruResult } from "./lru-select.ts";
import type { Narration, NarrationContext } from "./narration.ts";
import type { NotebookEntry } from "./notebook-types.ts";

export const DECISIONS = { hold: "判断を保留する", changes: "追加検証・修正を依頼する", merge: "マージを提案する" } as const;
export type ReviewDecision = keyof typeof DECISIONS;
export type Submission = { id: string; at: string; hypothesis: string; review: string; decision: ReviewDecision; reading: LruReading | null; results: LruResult[]; cleared: boolean; stage: string; unasked: boolean; narration: Narration };

export function reviewCheck(reading: LruReading | null, entries: NotebookEntry[]) {
  const results: LruResult[] = LRU_CASES.map((c) => reading ? judgeLru(c, reading) : { id: c.id, prediction: "undetermined", verdict: "undetermined", confidence: 0 });
  const matches = results.filter((r) => r.verdict === "match").length;
  const asked = new Set(entries.flatMap((e) => e.question?.topic ? [e.question.topic] : []));
  return { results, cleared: matches === LRU_CASES.length, stage: matches === 7 ? "全部" : matches >= 5 ? "あと少し" : matches >= 3 ? "半分" : "まだ", unasked: asked.size < Object.keys(QUESTION_TOPICS).length };
}

export function reviewContext(submission: Omit<Submission, "narration">, entries: NotebookEntry[]): NarrationContext {
  return { mode: "review", playerText: JSON.stringify({ hypothesis: submission.hypothesis, review: submission.review, decision: DECISIONS[submission.decision] }),
    allowedFacts: {
      scope: "CPython 3.12.3の変更前の実測。PRは演習用の架空の提案。変更後の性能やメモリは未測定。理解度の採点ではない。",
      checked: { stage: submission.stage, cleared: submission.cleared, unasked: submission.unasked, interpretationAvailable: !!submission.reading },
      tests: LRU_CASES.map((c) => ({ id: c.id, calls: c.calls, typed: c.typed, actual: LRU_LABEL[c.actual], observation: c.observation, code: c.evidence.code, comparisonFromInterpretedHypothesis: submission.results.find((r) => r.id === c.id) })),
      investigated: entries.filter((e) => e.question?.topic).map((e) => ({ question: e.question!.question, answer: e.question!.answer, cases: e.cases })).slice(-20),
      maintainerResponse: "bpo-39554の返答の要約：typed=Falseは等しい値の同一視を要求しない。int向け省スペース経路を可能にする余地があり、int/floatが別になる。結論はnot a bug。",
    }, fallback: submission.reading ? `現在の読み取りで説明が通る段階：${submission.stage}。下の照合表と実際のメンテナの返答を比較してください。これは7事例の範囲での確認で、理解度やマージ判断の採点ではありません。` : "レビューは保存しましたが、仮説の読み取りができないため照合は未確定です。下の実測とメンテナの返答を確認し、必要なら再提出してください。" };
}
