import type { CaseCard, Outcome } from "@/subject/cases";
import { AXES, type Axis, type Reading } from "./jev";

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

/**
 * 仮説の読み取り（Jev）を事例に当てはめて予想を出す（コード側の推論）。
 * - 仮説が挙げた条件がすべて成り立つ操作 → 登録は増えない（same）
 * - 「同じIDで中身が違えば拒否」を挙げていて、それに当てはまる → rejected
 * - 条件が成り立たない → 通常どおり created
 * - 読めない条件が結果を左右する / 条件をひとつも読めない → undetermined
 */
export function predict(c: CaseCard, r: Reading): { prediction: Prediction; confidence: number } {
  const conditions: Axis[] = ["sameContent", "sameKey", "retry"];
  const named = conditions.filter((a) => r[a] >= NAMED);
  const unclear = conditions.filter((a) => r[a] >= UNCLEAR && r[a] < NAMED);
  const relevant = [...named, ...unclear, ...(r.rejectConflict >= UNCLEAR ? (["rejectConflict"] as Axis[]) : [])];
  const confidence = relevant.length ? Math.min(...relevant.map((a) => Math.abs(r[a] - 0.5) * 2)) : 0;

  // 1回目の操作（比べる相手がない）は常に登録される
  if (c.steps.length < 2) return { prediction: "created", confidence: 1 };

  if (named.length === 0 && unclear.length === 0 && r.rejectConflict < UNCLEAR) {
    return { prediction: "undetermined", confidence: 0 };
  }

  const holds = (a: Axis) => (a === "rejectConflict" ? c.features.sameKey && !c.features.sameContent : c.features[a]);

  // 拒否の節は独立して先に評価する
  if (c.features.sameKey && !c.features.sameContent) {
    if (r.rejectConflict >= NAMED) return { prediction: "rejected", confidence };
    if (r.rejectConflict >= UNCLEAR) return { prediction: "undetermined", confidence };
  }

  const blockedStrict = named.length > 0 && named.every(holds);
  const blockedLoose = named.length + unclear.length > 0 && [...named, ...unclear].every(holds);
  if (blockedStrict !== blockedLoose) return { prediction: "undetermined", confidence };
  return { prediction: blockedStrict ? "same" : "created", confidence };
}

export function judge(c: CaseCard, r: Reading): CaseResult {
  const { prediction, confidence } = predict(c, r);
  const verdict: Verdict =
    prediction === "undetermined" ? "undetermined" : prediction === c.actual.outcome ? "match" : "mismatch";
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
