import { narrate, questionContext, screenText, generateText } from "../src/lib/narration.ts";
import { answerQuestion } from "../src/subject/lru-questions.ts";
import { reviewCheck, reviewContext } from "../src/lib/review.ts";
const context = questionContext("型は関係ある？", answerQuestion("types"));
const draft = { id: "test", at: new Date().toISOString(), hypothesis: "型が違えば常に別の呼び出しになる", review: "型が違えば別だと思っていましたがL6の結果が説明できません。追加検証を依頼します。", decision: "changes" as const, reading: { rule: .98, form: .02, order: .02, types: .98, singleFast: .02, typed: .02 } };
for (const c of [context, questionContext("型は関係ある？", answerQuestion("types"), true), reviewContext({ ...draft, ...reviewCheck(draft.reading, []) }, [])]) {
  const start = Date.now(); const result = await narrate(c);
  console.log(JSON.stringify({ mode: c.mode, ...result, ms: Date.now() - start }));
  if (result.source !== "generated") process.exitCode = 1;
  if (process.env.DEBUG_NARRATION && result.source === "fallback") { const sample = await generateText(c); console.log(JSON.stringify({ diagnosticDraft: sample.text, passes: await screenText(c, sample.text) })); }
}
for (const text of ["実際は引数が1個のときだけintとfloatを区別します。", "この修正は必ず安全で性能も2倍になります。あなたは完全に理解しました。", "場合によります。L5では再計算、L6では記憶を使いました。2枚を比べてみてください。"] ) {
  const accepted = await screenText(context, text);
  console.log(JSON.stringify({ text, accepted }));
  const shouldPass = text.startsWith("場合"); if (accepted !== shouldPass) process.exitCode = 1;
}
