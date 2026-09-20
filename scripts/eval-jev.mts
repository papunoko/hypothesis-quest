import { readHypothesis } from "../src/lib/jev.ts";
import { CASES } from "../src/subject/cases.ts";
import { judge, pickNext } from "../src/lib/select.ts";

const hypotheses = [
  "同じ商品は重複して登録しない",
  "同じ依頼IDなら、登録は1件のまま",
  "再送では登録を増やさない",
  "再送では登録を増やさない。同じ依頼IDで中身が違えば拒否する",
  "同じ依頼IDで同じ中身なら前の結果を返す。同じ依頼IDで中身が違えば拒否する",
  "よくわからない",
];

const expected = ["C3", "C4", "C4", "C5", "C1", "C2"];
for (const [index, hypothesis] of hypotheses.entries()) {
  const start = performance.now();
  const reading = await readHypothesis(hypothesis);
  const results = CASES.map((c) => judge(c, reading));
  const { next, reason } = pickNext(results, new Set());
  const pass = next?.id === expected[index];
  if (!pass) process.exitCode = 1;
  console.log(JSON.stringify({ hypothesis, reading, next: next?.id, reason, pass, results, ms: Math.round(performance.now() - start) }));
}
