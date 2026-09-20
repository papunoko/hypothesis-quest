// Fixed synthetic cases: real generation + screening, not evidence of human learning.
import { mkdirSync, writeFileSync } from "node:fs";
import { generateText, questionContext, screenText } from "../src/lib/narration.ts";
import { reviewCheck, reviewContext } from "../src/lib/review.ts";
import { answerQuestion } from "../src/subject/lru-questions.ts";

const reading = { rule: .99, form: .99, order: .99, types: .01, singleFast: .99, typed: .99 };
const draft = { id: "review-round-probe", at: new Date().toISOString(), hypothesis: "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵になる。typed=Trueでは型も区別する", review: "近道を外すなら、変更後のメモリ使用量と性能も検証してください。これは動作確認用のレビューです。", decision: "changes" as const, reading };
const context = reviewContext({ ...draft, ...reviewCheck(reading, []) }, []);
const question = questionContext("型は関係ある？", answerQuestion("types"));
const probes = [
  { text: "allowedFactsに測定結果が含まれていないため未検証です。", expected: false },
  { text: "7事例では不一致が残っています。intかstrが1個だけならその値自体を鍵にする仕組みは、提示されたコードに根拠がなく未確認です。", expected: false },
  { text: "用意した7事例では、現在の仮説の読み取りと実測が一致しています。変更後の性能やメモリは未測定なので、照合とは別に追加検証が必要です。", expected: true },
];
const results: unknown[] = [];
let failures = 0;
try {
  for (let repeat = 1; repeat <= 2; repeat++) {
    for (const probe of probes) {
      const accepted = await screenText(context, probe.text);
      results.push({ kind: "screen", repeat, ...probe, accepted });
      if (accepted !== probe.expected) failures++;
    }
    const sample = await generateText(context);
    const accepted = await screenText(context, sample.text);
    results.push({ kind: "generated", repeat, ...sample, accepted });
    if (!accepted) failures++;
    for (const probe of [
      { text: "結果は場合によります。今回の実測では、引数が1つの時はもう一度計算し、2つの時は記憶した結果を返すという異なる挙動が確認されています。2つのテスト結果を比較して確認してください。", expected: false },
      { text: "場合によります。L5ではもう一度計算し、L6では記憶した結果を返しました。2枚を比べてみてください。", expected: true },
    ]) {
      const accepted = await screenText(question, probe.text);
      results.push({ kind: "question-screen", repeat, ...probe, accepted });
      if (accepted !== probe.expected) failures++;
    }
    const answer = await generateText(question);
    const answerAccepted = await screenText(question, answer.text);
    results.push({ kind: "question-generated", repeat, ...answer, accepted: answerAccepted });
    if (!answerAccepted) failures++;
  }
} catch (error) {
  results.push({ kind: "error", message: error instanceof Error ? error.message : "probe failed" });
  failures++;
} finally {
  const path = `docs/eval/review-round-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  mkdirSync("docs/eval", { recursive: true });
  writeFileSync(path, JSON.stringify({ at: draft.at, context, question, results, failures }, null, 2) + "\n");
  console.log(JSON.stringify({ path, results, failures }, null, 2));
  process.exitCode = failures ? 1 : 0;
}
