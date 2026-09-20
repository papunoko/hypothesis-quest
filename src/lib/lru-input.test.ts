import { test } from "node:test";
import assert from "node:assert/strict";
import { readLruInput } from "./lru-input.ts";
import { LRU_AXES } from "../subject/lru.ts";

test("表示専用の核心度が欠落・不正でも比較軸は読めるが、比較軸の不正は拒否する", async (t) => {
  const originalKey = process.env.JEV_API_KEY;
  process.env.JEV_API_KEY = "test-only";
  t.after(() => {
    if (originalKey === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = originalKey;
  });
  const answers: Record<string, unknown> = {
    ...Object.fromEntries(Object.keys(LRU_AXES).map((key) => [key, { type: "noul", noul: 0.9 }])),
    kind: { type: "choice", choice: "question", confidence: 1, probabilities: { question: 1, assertion: 0, other: 0 } },
    topic: { type: "choice", choice: "types", confidence: 1, probabilities: { types: 1, form: 0, order: 0, arity: 0, typed: 0, unrelated: 0, unsupported: 0 } },
  };
  t.mock.method(globalThis, "fetch", async () => Response.json({ answers }));
  const baseline = await readLruInput("型は関係ある？");
  assert.equal(baseline.coreRelevance, undefined);
  for (const value of [0, 1, null, "0.9", -0.1, 1.1]) {
    answers.coreRelevance = { type: "noul", noul: value };
    const result = await readLruInput("型は関係ある？");
    assert.equal(result.coreRelevance, value === 0 || value === 1 ? value : undefined);
    assert.deepEqual(result.reading, baseline.reading);
    assert.equal(result.kind, baseline.kind);
    assert.equal(result.topic, baseline.topic);
  }
  answers.types = { type: "noul", noul: null };
  await assert.rejects(readLruInput("型は関係ある？"), /Invalid Jev answer: types/);
});
