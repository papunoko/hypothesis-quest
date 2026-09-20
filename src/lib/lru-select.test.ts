import { test } from "node:test";
import assert from "node:assert/strict";
import { LRU_CASES, LRU_HOLDOUT, type LruReading } from "../subject/lru.ts";
import { judgeLru, nextLru, predictLru } from "./lru-select.ts";
const reading = (r: Partial<LruReading> = {}): LruReading => ({ rule: 0.98, form: 0.02, order: 0.02, types: 0.02, singleFast: 0.02, typed: 0.02, ...r });

test("題材2の仮説の階段がL2→L4→L5→L6へ分岐する", () => {
  for (const [r, id] of [[reading(), "L2"], [reading({ form: 0.98 }), "L4"], [reading({ form: 0.98, order: 0.98 }), "L5"], [reading({ form: 0.98, order: 0.98, types: 0.98 }), "L6"]] as const) {
    const next = nextLru(LRU_CASES.map((c) => judgeLru(c, r)), new Set(["L1"]));
    assert.equal(next?.id, id); assert.equal(next.verdict, "mismatch");
  }
});
test("単一引数の例外とtyped設定を含めた仮説は全7例を説明する", () => {
  const r = reading({ form: 0.98, order: 0.98, singleFast: 0.98, typed: 0.98 });
  assert.ok(LRU_CASES.every((c) => judgeLru(c, r).verdict === "match"));
});
test("関係ない文・曖昧な条件は反証と断定しない", () => {
  assert.ok(LRU_CASES.every((c) => predictLru(c, reading({ rule: 0.1 })).prediction === "undetermined"));
  assert.equal(predictLru(LRU_CASES[1], reading({ form: 0.5 })).prediction, "undetermined");
  assert.equal(judgeLru(LRU_CASES[1], reading({ form: 0.3 })).verdict, "undetermined");
});
test("単一特例が明示され一般の型条件が未確定でも全7例が一致する（F-01）", () => {
  for (const types of [0.36, 0.38, 0.39, 0.4, 0.5, 0.599]) {
    const r = reading({ form: 0.98, order: 0.98, types, singleFast: 0.98, typed: 0.98 });
    assert.ok(LRU_CASES.every((c) => judgeLru(c, r).verdict === "match"), `types=${types}`);
    assert.equal(r.types, types, "鏡に渡す生の読み取りは変えない");
  }
});
test("一般の型条件を明示した仮説は、単一特例があってもL6で一致にしない", () => {
  assert.equal(judgeLru(LRU_CASES[5], reading({ types: 0.98, singleFast: 0.98 })).verdict, "mismatch");
  assert.equal(predictLru(LRU_CASES[5], reading({ types: 0.6, singleFast: 0.98 })).prediction, "computed");
  assert.equal(judgeLru(LRU_CASES[5], reading({ types: 0.38, singleFast: 0.599 })).verdict, "undetermined");
  assert.equal(judgeLru(LRU_CASES[1], reading({ types: 0.38, singleFast: 0.98, form: 0.5 })).verdict, "undetermined");
});
test("L8は仮説選択の対象にせず、7例が尽きたら終了", () => {
  assert.equal(LRU_CASES.length, 7);
  assert.equal(nextLru(LRU_CASES.map((c) => judgeLru(c, reading())), new Set(LRU_CASES.map((c) => c.id))), null);
});
test("holdoutは7事例に混ざらず、単一特例と一般の型条件を区別する", () => {
  assert.ok(!LRU_CASES.some((c) => c.id === LRU_HOLDOUT.id));
  assert.equal(judgeLru(LRU_HOLDOUT, reading({ form: 0.98, order: 0.98, types: 0.38, singleFast: 0.98, typed: 0.98 })).verdict, "match");
  assert.equal(judgeLru(LRU_HOLDOUT, reading({ types: 0.98 })).verdict, "mismatch");
});
