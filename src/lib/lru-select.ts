import { LRU_AXES, type LruAxis, type LruCase, type LruReading, type LruOutcome } from "../subject/lru.ts";
export type LruPrediction = LruOutcome | "undetermined";
export type LruResult = { id: string; prediction: LruPrediction; confidence: number; verdict: "match" | "mismatch" | "undetermined" };
const axes = Object.keys(LRU_AXES) as LruAxis[];
type Interpretation = Record<LruAxis, boolean>;

export function predictLru(c: LruCase, r: LruReading): { prediction: LruPrediction; confidence: number } {
  // A named single-argument exception is not a blanket type requirement.
  // Keep an explicitly named blanket requirement, even when it contradicts the exception.
  const singleExceptionOnly = r.singleFast >= 0.6 && r.types < 0.6;
  const apply = (rule: Interpretation): LruPrediction => {
    if (!rule.rule) return "undetermined";
    if (rule.form && !c.features.form || rule.order && !c.features.order || rule.types && !c.features.types || rule.singleFast && c.features.singleFast || rule.typed && c.typed && !c.features.types) return "computed";
    return "remembered";
  };
  let readings: Interpretation[] = [{} as Interpretation];
  for (const axis of axes) {
    const possible = axis === "types" && singleExceptionOnly ? [false] : r[axis] >= 0.6 ? [true] : r[axis] < 0.4 ? [false] : [false, true];
    readings = readings.flatMap((reading) => possible.map((value) => ({ ...reading, [axis]: value })));
  }
  const outcomes = new Set(readings.map(apply));
  const prediction = outcomes.size === 1 ? [...outcomes][0] : "undetermined";
  if (prediction === "undetermined") return { prediction, confidence: 0 };
  const relevant = axes.filter((axis) => !(axis === "types" && singleExceptionOnly) && readings.some((reading) => apply({ ...reading, [axis]: !reading[axis] }) !== prediction));
  const confidence = Math.min(...relevant.map((axis) => Math.abs(r[axis] - 0.5) * 2));
  return { prediction, confidence };
}
export function judgeLru(c: LruCase, reading: LruReading): LruResult {
  const result = predictLru(c, reading);
  return { id: c.id, ...result, verdict: result.prediction === "undetermined" || result.confidence < 0.55 ? "undetermined" : result.prediction === c.actual ? "match" : "mismatch" };
}
export function nextLru(results: LruResult[], shown: Set<string>): LruResult | null {
  const unseen = results.filter((r) => !shown.has(r.id));
  return unseen.find((r) => r.verdict === "mismatch") ?? unseen.find((r) => r.verdict === "undetermined") ?? unseen[0] ?? null;
}
