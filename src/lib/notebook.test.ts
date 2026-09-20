import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import { openNotebook } from "./notebook-d1.ts";
import type { NotebookEntry } from "./notebook-types.ts";
import { reviewCheck, type Submission } from "./review.ts";

async function database() {
  const proxy = await getPlatformProxy<CloudflareEnv>({ persist: false, envFiles: [] });
  const sql = readFileSync(new URL("../../migrations/0001_notebook.sql", import.meta.url), "utf8");
  for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await proxy.env.DB.prepare(statement).run();
  return proxy;
}

test("D1の帳面は次のリクエストでも残り、セッションを混ぜず、同じIDを二重保存しない", async () => {
  const proxy = await database();
  const entry: NotebookEntry = { id: "one", at: "2026-09-20T00:00:00Z", hypothesis: "型は関係ある？", kind: "question", answer: "場合による", cases: ["L5", "L6"], interpretation: { kind: "question", topic: "types", needsKind: false, needsTopic: false, kindProbabilities: { question: 0.95, assertion: 0.03, other: 0.02 }, reading: { rule: 0.1, form: 0.1, order: 0.1, types: 0.9, singleFast: 0.1, typed: 0.1 } } };
  let db = openNotebook(proxy.env.DB.withSession("first-primary"));
  try {
    await Promise.all([db.append("session-a", entry), db.append("session-a", entry)]);
    await db.append("session-b", { ...entry, hypothesis: "別の人の入力" });
    assert.deepEqual(await db.list("session-a"), [entry]);
    assert.deepEqual(await db.list("' OR 1=1 --"), []);
    db = openNotebook(proxy.env.DB.withSession("first-primary"));
    assert.deepEqual(await db.list("session-a"), [entry]);
    assert.equal((await db.list("session-b"))[0].hypothesis, "別の人の入力");
    const hint = { text: "ヒント", source: "fallback" as const };
    await db.saveHint("session-a", entry.id, hint);
    assert.deepEqual((await db.list("session-a"))[0], { ...entry, hint });
    assert.equal((await db.list("session-b"))[0].hint, undefined);
    await db.saveHint("unknown", entry.id, hint);
    assert.deepEqual(await db.list("unknown"), []);
  } finally { await proxy.dispose(); }
});

test("D1の提出は別セッションに漏れず、同時再送は同じ保存結果を返す", async () => {
  const proxy = await database();
  const store = openNotebook(proxy.env.DB.withSession("first-primary"));
  const submission: Submission = { id: "same-request", at: "2026-09-20T00:00:00Z", hypothesis: "同じ引数なら記憶を返す", review: "確認したい", decision: "hold", reading: null, ...reviewCheck(null, []), narration: { text: "定型文", source: "fallback", reason: "unavailable" } };
  try {
    const results = await Promise.all([store.submit("a", submission), store.submit("a", submission)]);
    assert.deepEqual(results, [submission, submission]);
    assert.deepEqual(await store.submit("a", { ...submission, review: "上書きしない" }), submission);
    assert.equal((await store.submissions("a")).length, 1);
    assert.deepEqual(await store.submissions("b"), []);
  } finally { await proxy.dispose(); }
});
