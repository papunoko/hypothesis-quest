/**
 * Jev には「仮説文」だけを読ませる。
 * 仮説が、登録を増やさない条件として何を挙げているかを、軸ごとに Noul で判定する。
 * 事例への当てはめ（予想）はコード側（select.ts）。実際の結果は Jev に渡さない。
 *
 * ※ 最初は事例ごとに Choice で「仮説に従うと結果は？」を聞いたが、
 *    Jev は状況文の含意（「意図して2件目」「IDを作り直した」）に引っ張られ、仮説を機械的に適用できなかった。
 *    判断モデルには判断だけをさせ、推論はコードで持つ。
 */

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

const WORLD = `注文登録APIについて、プレイヤーが「この仕組みは何を守っているか」を一文で書きました。
API: 注文を送ると登録されます。各リクエストには 商品・数量 と、任意で 依頼ID が付きます。
以下の仮説の文面だけを読んで答えてください。APIの実装や一般的な知識で補わないでください。`;

const QUESTIONS: Record<Axis, string> = {
  sameContent:
    "この仮説は、「商品（または注文の中身）が前と同じであること」を、登録を増やさない・重複させない条件として挙げているか？",
  sameKey: "この仮説は、「依頼IDが前と同じであること」を、登録を増やさない・1件のままにする条件として挙げているか？",
  retry:
    "この仮説は、「再送であること（同じ注文をもう一度送ること・通信の再試行）」を、登録を増やさない条件として挙げているか？",
  rejectConflict: "この仮説は、「同じ依頼IDなのに中身が違う場合は拒否（エラー）する」と言っているか？",
};

export async function readHypothesis(hypothesis: string): Promise<Reading> {
  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) throw new Error("JEV_API_KEY is not set");

  const questions = Object.fromEntries(AXES.map((a) => [a, { type: "noul", instructions: QUESTIONS[a] }]));

  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      state: `${WORLD}\n\n# プレイヤーの仮説\n「${hypothesis}」`,
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
    // Noul: probabilities に yes/no の確率が入る。無ければ noul(0/1) を使う
    const p = typeof ans.probabilities?.yes === "number" ? ans.probabilities.yes : typeof ans.noul === "number" ? ans.noul : 0;
    reading[a] = p;
  }
  return reading;
}
