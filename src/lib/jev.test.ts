import { test } from "node:test";
import assert from "node:assert/strict";
import { AXES, readHypothesis } from "./jev.ts";

test("v1 Noulの確率を読み、不正な値・欠落を失敗として扱う", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ answers }));
  const originalKey = process.env.JEV_API_KEY;
  process.env.JEV_API_KEY = "test-only";
  t.after(() => {
    if (originalKey === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = originalKey;
  });
  let answers: Record<string, unknown> = Object.fromEntries(AXES.map((a) => [a, { type: "noul", noul: 0.75 }]));
  assert.equal((await readHypothesis("テスト")).sameKey, 0.75);
  for (const value of [undefined, null, "0.9", -0.1, 1.1]) {
    answers.sameKey = { type: "noul", noul: value };
    await assert.rejects(readHypothesis("テスト"), /invalid answers.sameKey/);
  }
  answers = {};
  await assert.rejects(readHypothesis("テスト"), /missing answers/);
});
