import { test } from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../subject/cases.ts";
import { judge, pickNext, predict } from "./select.ts";
import type { Reading } from "./jev.ts";

const reading = (overrides: Partial<Reading> = {}): Reading => ({
  sameContent: 0.02, sameKey: 0.02, retry: 0.02, rejectConflict: 0.02, ...overrides,
});
const card = (id: string) => CASES.find((c) => c.id === id)!;

test("商品・依頼ID・再送の仮説で異なる反例を選ぶ", () => {
  for (const [r, expected] of [
    [reading({ sameContent: 0.95 }), "C3"],
    [reading({ sameKey: 0.95 }), "C4"],
    [reading({ retry: 0.95, rejectConflict: 0.95 }), "C5"],
  ] as const) {
    const result = pickNext(CASES.map((c) => judge(c, r)), new Set());
    assert.equal(result.next?.id, expected);
    assert.equal(result.reason, "mismatch");
  }
});

test("複合仮説は6事例の実結果と一致する", () => {
  const r = reading({ sameContent: 0.95, sameKey: 0.95, rejectConflict: 0.95 });
  assert.ok(CASES.every((c) => judge(c, r).verdict === "match"));
});

test("曖昧な軸だけで新規登録を断定しない", () => {
  assert.equal(predict(card("C3"), reading({ retry: 0.5 })).prediction, "undetermined");
  assert.equal(predict(card("C2"), reading()).prediction, "undetermined");
});

test("結果を左右する曖昧な条件だけを確認に回す", () => {
  const r = reading({ sameContent: 0.95, sameKey: 0.5 });
  assert.equal(predict(card("C3"), r).prediction, "undetermined");
  assert.equal(predict(card("C2"), r).prediction, "same");
  const rejection = predict(card("C4"), reading({ retry: 0.5, rejectConflict: 0.95 }));
  assert.equal(rejection.prediction, "rejected");
  assert.ok(rejection.confidence > 0.55);
});

test("拒否節が無いという読みの弱さも確認に回す", () => {
  const result = judge(card("C4"), reading({ sameKey: 0.95, rejectConflict: 0.35 }));
  assert.equal(result.prediction, "same");
  assert.equal(result.verdict, "undetermined");
});

test("低強度の食い違いは、反証として選ばない", () => {
  const result = judge(card("C3"), reading({ sameContent: 0.6 }));
  assert.equal(result.verdict, "undetermined");
  const high = judge(card("C4"), reading({ sameKey: 0.95 }));
  assert.equal(pickNext([result, high], new Set()).next?.id, "C4");
});

test("提示済みを飛ばし、尽きたら終了する", () => {
  const results = CASES.map((c) => judge(c, reading({ sameContent: 0.95 })));
  assert.equal(pickNext(results, new Set(["C3"])).next?.id, "C4");
  assert.deepEqual(pickNext(results, new Set(CASES.map((c) => c.id))), { next: null, reason: "exhausted" });
});
