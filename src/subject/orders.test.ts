import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderStore } from "./orders.ts";
import { CASES } from "./cases.ts";

// 事例カードの「実結果」が題材コードの実行結果と一致することを確認する（D-03 の検証記録）
for (const c of CASES) {
  test(`${c.id} ${c.title}`, () => {
    const store = new OrderStore();
    let last;
    for (const s of c.steps) {
      last = store.create({ productId: s.productId, qty: s.qty }, s.key ?? undefined);
    }
    assert.ok(last);
    assert.equal(store.count(), c.actual.count, "件数");
    assert.equal(last.status, c.actual.status, "最後の応答");
    const outcome = last.status === 201 ? "created" : last.status === 200 ? "same" : "rejected";
    assert.equal(outcome, c.actual.outcome, "結果ラベル");
  });
}
