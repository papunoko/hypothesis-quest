import test from "node:test";
import assert from "node:assert/strict";
import { narrate, questionContext, screenText } from "./narration.ts";
import { answerQuestion } from "../subject/lru-questions.ts";
const context = questionContext("型は関係ある？", answerQuestion("types"));

test("通常回答は観察のみ、明示的ヒントだけコードと原因の根拠を持つ", () => {
  assert.ok(!JSON.stringify(context.allowedFacts).includes("fasttypes"));
  assert.ok(JSON.stringify(questionContext("型は関係ある？", answerQuestion("types"), true).allowedFacts).includes("fasttypes"));
  assert.ok(!JSON.stringify(context.allowedFacts).includes("L7"));
});
test("未検問の生成文を表示せず、検問失敗・通信失敗は定型へ", async () => {
  const generate = async () => ({ text: "秘密の原因を捏造", model: "test" });
  const rejected = await narrate(context, undefined, { generate, screen: async () => false });
  assert.equal(rejected.source, "fallback"); assert.equal(rejected.reason, "screened");
  assert.ok(!JSON.stringify(rejected).includes("捏造"));
  const offline = await narrate(context, undefined, { generate, screen: async () => { throw new Error("timeout"); } });
  assert.equal(offline.source, "fallback"); assert.equal(offline.reason, "unavailable");
  const llmOffline = await narrate(context, undefined, { generate: async () => { throw new Error("offline"); }, screen: async () => true });
  assert.equal(llmOffline.source, "fallback");
  const accepted = await narrate(context, undefined, { generate: async () => ({ text: "結果が分かれています。", model: "test" }), screen: async () => true });
  assert.equal(accepted.source, "generated");
});
test("3つの検問を同じ根拠でまとめ、0.30以上または不正応答で通さない", async (t) => {
  const previous = process.env.JEV_API_KEY; process.env.JEV_API_KEY = "test-only";
  let risk = 0.29; let invalid = false;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    assert.equal(Object.keys(body.questions).length, body.state.mode === "question" ? 3 : 2);
    assert.deepEqual(body.state.allowedFacts, context.allowedFacts);
    assert.equal(body.state.playerText, "型は関係ある？");
    return Response.json({ answers: Object.fromEntries(["unsupported", "grading", "spoiler"].map((key) => [key, { type: invalid ? "choice" : "noul", noul: risk }])) });
  });
  try {
    assert.equal(await screenText(context, "回答"), true);
    risk = 0.30; assert.equal(await screenText(context, "回答"), false);
    invalid = true; await assert.rejects(screenText(context, "回答"));
    invalid = false; risk = 0.1;
    assert.equal(await screenText({ ...context, mode: "hint" }, "理由を説明する"), true);
  } finally { if (previous === undefined) delete process.env.JEV_API_KEY; else process.env.JEV_API_KEY = previous; }
});

test("内部フィールド名の露出はJevを呼ぶ前に表示を見送る", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not call"); });
  for (const label of ["allowedFacts", "playerText", "maintainerResponse", "comparisonFromInterpretedHypothesis", "interpretationAvailable"]) {
    assert.equal(await screenText({ ...context, mode: "review" }, `${label}には測定結果がありません。`), false);
  }
  assert.equal(mock.mock.callCount(), 0);
});
