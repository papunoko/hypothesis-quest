import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion, QUESTION_TOPICS } from "../subject/lru-questions.ts";
import { LRU_CASES } from "../subject/lru.ts";
import { parseChoice } from "./lru-input.ts";

test("型の答えは少数側を丸めず、L5/L6の割れから場合によるになる", () => {
  const answer = answerQuestion("types");
  assert.equal(answer.answer, "場合による");
  assert.deepEqual(answer.cases, ["L5", "L6"]);
  assert.equal(answer.core, true);
  for (const spec of Object.values(QUESTION_TOPICS)) for (const id of spec.cases) assert.ok(LRU_CASES.some((c) => c.id === id));
});
test("書き方・順番・設定の答えは固定の実測から計算する", () => {
  for (const topic of ["form", "order", "arity", "typed"] as const) assert.equal(answerQuestion(topic).answer, "はい");
  assert.deepEqual(answerQuestion("typed").cases, ["L6", "L7"]);
});
test("未検証と無関係を混同しない", () => {
  assert.equal(answerQuestion("unsupported").answer, "まだ答えられません");
  assert.equal(answerQuestion("unrelated").answer, "関係ない");
  assert.deepEqual(answerQuestion("unsupported").cases, []);
});
test("Choiceの未知値、欠損、分布違反を拒否する", () => {
  const answer = { type: "choice", choice: "question", confidence: 0.9, probabilities: { question: 0.9, assertion: 0.1 } };
  assert.equal(parseChoice(answer, ["question", "assertion"]).choice, "question");
  for (const broken of [null, {}, { ...answer, choice: "other" }, { ...answer, probabilities: { question: 1, assertion: 1 } }, { ...answer, probabilities: { question: 0.1, assertion: 0.9 } }, { ...answer, confidence: NaN }]) assert.throws(() => parseChoice(broken, ["question", "assertion"]));
});
