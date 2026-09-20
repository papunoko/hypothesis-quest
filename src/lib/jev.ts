/**
 * Jev には「仮説文」だけを読ませる。
 * 仮説が、登録を増やさない条件として何を挙げているかを、軸ごとに Noul で判定する。
 * 事例への当てはめ（予想）はコード側（select.ts）。実際の結果は Jev に渡さない。
 *
 * ※ 最初は事例ごとに Choice で「仮説に従うと結果は？」を聞いたが、
 *    Jev は状況文の含意（「意図して2件目」「IDを作り直した」）に引っ張られ、仮説を機械的に適用できなかった。
 *    判断モデルには判断だけをさせ、推論はコードで持つ。
 */

import { serverEnv } from "./server-env.ts";
export const AXES = ["sameContent", "sameKey", "retry", "rejectConflict"] as const;
export type Axis = (typeof AXES)[number];

export const AXIS_LABEL: Record<Axis, string> = {
  sameContent: "商品・中身が同じであること",
  sameKey: "依頼IDが同じであること",
  retry: "再送であること（同じ注文をもう一度送る）",
  rejectConflict: "同じ依頼IDで中身が違えば拒否する",
};

/** 各軸の確率（仮説がその条件を挙げている確率） */
export type Reading = Record<Axis, number>;

const QUESTIONS: Record<Axis, string> = {
  sameContent: "Does `hypothesis` explicitly name matching products or contents as a condition for reusing a registration?",
  sameKey: "Does `hypothesis` explicitly name matching request IDs as a condition for reusing a registration?",
  retry: "Does `hypothesis` explicitly mention retries or resending as a condition for preventing duplicate registrations?",
  rejectConflict: "Does `hypothesis` say to reject different contents sent with the same request ID?",
};

const CRITERIA: Record<Axis, { true: string; false: string }> = {
  sameContent: {
    true: "The reuse/deduplication rule explicitly says 同じ商品 or 同じ中身 (or equivalent).",
    false: "Only IDs or retries are named. Different contents mentioned in a rejection clause do not count.",
  },
  sameKey: {
    true: "The reuse/deduplication rule explicitly says 同じ依頼ID (or equivalent).",
    false: "Only products or retries are named. IDs mentioned only in a rejection clause do not count.",
  },
  retry: {
    true: "The text explicitly says 再送, 再試行, もう一度送る (or equivalent).",
    false: "No retry/resending is mentioned. Matching IDs or products alone do not imply retries.",
  },
  rejectConflict: {
    true: "Explicit rejection/error for different contents with the same ID.",
    false: "No rejection clause. Keeping one registration alone does not imply rejection.",
  },
};

export async function readHypothesis(hypothesis: string): Promise<Reading> {
  const apiKey = serverEnv("JEV_API_KEY");
  if (!apiKey) throw new Error("JEV_API_KEY is not set");

  const questions = Object.fromEntries(AXES.map((a) => [a, { type: "noul", instructions: QUESTIONS[a], criteria: CRITERIA[a] }]));

  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      state: { hypothesis },
      model: "jev-latest",
      questions,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
  const json = await res.json();

  const reading = {} as Reading;
  for (const a of AXES) {
    const ans = json.answers?.[a];
    if (!ans) throw new Error(`Jev response missing answers.${a}`);
    // v1 Noul の値そのものが yes の確率。不正な応答を「no」に変換しない。
    const p = ans.noul;
    if (ans.type !== "noul" || typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Jev response invalid answers.${a}`);
    }
    reading[a] = p;
  }
  return reading;
}
