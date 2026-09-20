import type { CaseCard, Outcome } from "@/subject/cases";
import { AXES, type Axis, type Reading } from "./jev.ts";

export type Prediction = Outcome | "undetermined";
export type Verdict = "mismatch" | "undetermined" | "match";

export type CaseResult = {
  id: string;
  prediction: Prediction;
  confidence: number;
  verdict: Verdict;
};

const NAMED = 0.6; // これ以上なら「仮説はこの条件を挙げている」
const UNCLEAR = 0.4; // NAMED 未満・これ以上なら「挙げているか読めない」
export const CONFIDENCE_THRESHOLD = 0.55;

/**
 * 仮説の読み取り（Jev）を事例に当てはめて予想を出す（コード側の推論）。
 * - 仮説が挙げた条件がすべて成り立つ操作 → 登録は増えない（same）
 * - 「同じIDで中身が違えば拒否」を挙げていて、それに当てはまる → rejected
 * - 条件が成り立たない → 通常どおり created
 * - 読めない条件が結果を左右する / 条件をひとつも読めない → undetermined
 */
export function predict(c: CaseCard, r: Reading): { prediction: Prediction; confidence: number } {
  // 1回目の操作（比べる相手がない）は常に登録される
  if (c.steps.length < 2) return { prediction: "created", confidence: 1 };
  const conditions = ["sameContent", "sameKey", "retry"] as const;
  type Interpretation = Record<Axis, boolean>;
  const apply = (reading: Interpretation): Prediction => {
    if (reading.rejectConflict && c.features.sameKey && !c.features.sameContent) return "rejected";
    const named = conditions.filter((a) => reading[a]);
    if (!named.length) return "undetermined";
    return named.every((a) => c.features[a]) ? "same" : "created";
  };

  // 曖昧な軸の全組合せ（最大16通り）で結果が変わるなら、予想を断定しない。
  let interpretations: Interpretation[] = [{} as Interpretation];
  for (const a of AXES) {
    const values = r[a] >= NAMED ? [true] : r[a] < UNCLEAR ? [false] : [false, true];
    interpretations = interpretations.flatMap((reading) => values.map((value) => ({ ...reading, [a]: value })));
  }
  const outcomes = new Set(interpretations.map(apply));
  const prediction = outcomes.size === 1 ? [...outcomes][0] : "undetermined";
  if (prediction === "undetermined") return { prediction, confidence: 0 };

  // この事例の結果を変え得る軸だけを使う。「言及なし」の読みも根拠に含める。
  // Noul に confidence はないため、これは確率から計算するアプリ独自の判定強度。
  const relevant = AXES.filter((a) => interpretations.some((reading) =>
    apply({ ...reading, [a]: !reading[a] }) !== prediction));
  const evidence = relevant.length ? relevant : AXES.filter((a) => r[a] >= NAMED);
  const confidence = Math.min(...evidence.map((a) => Math.abs(r[a] - 0.5) * 2));
  return { prediction, confidence };
}

export function judge(c: CaseCard, r: Reading): CaseResult {
  const { prediction, confidence } = predict(c, r);
  const verdict: Verdict =
    prediction === "undetermined" || confidence < CONFIDENCE_THRESHOLD
      ? "undetermined" : prediction === c.actual.outcome ? "match" : "mismatch";
  return { id: c.id, prediction, confidence, verdict };
}

/**
 * 次に出す事例（コード側の判断。Jevは選ばない）
 * 1. 予想≠実際 の未提示事例        （反証）
 * 2. 「決まらない」の未提示事例     （適用範囲の穴）
 * 3. 残りの未提示事例
 * 4. なし → 終了（「正しい」とは言わない）
 */
export function pickNext(results: CaseResult[], shown: Set<string>): { next: CaseResult | null; reason: Verdict | "exhausted" } {
  const unshown = results.filter((r) => !shown.has(r.id));
  const byVerdict = (v: Verdict) => unshown.find((r) => r.verdict === v);
  const mm = byVerdict("mismatch");
  if (mm) return { next: mm, reason: "mismatch" };
  const un = byVerdict("undetermined");
  if (un) return { next: un, reason: "undetermined" };
  if (unshown[0]) return { next: unshown[0], reason: "match" };
  return { next: null, reason: "exhausted" };
}

export { AXES };
