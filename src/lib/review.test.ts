import test from "node:test";
import assert from "node:assert/strict";
import { reviewCheck } from "./review.ts";
test("7事例すべて一致のときだけクリア・読み取り失敗を成功にしない", () => {
  const reading = { rule: 0.99, form: 0.99, order: 0.99, types: 0.01, singleFast: 0.99, typed: 0.99 };
  const complete = reviewCheck(reading, []);
  assert.equal(complete.cleared, true); assert.equal(complete.stage, "全部"); assert.equal(complete.unasked, true);
  assert.equal(reviewCheck({ ...reading, singleFast: 0.01 }, []).cleared, false);
  assert.equal(reviewCheck({ ...reading, singleFast: 0.5 }, []).cleared, false);
  const failed = reviewCheck(null, []);
  assert.equal(failed.cleared, false); assert.ok(failed.results.every((r) => r.verdict === "undetermined"));
});
