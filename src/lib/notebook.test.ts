import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openNotebook } from "./notebook.ts";
import type { NotebookEntry } from "./notebook-types.ts";
import { reviewCheck, type Submission } from "./review.ts";

test("SQLiteの帳面は再接続後も残り、セッションを混ぜず、同じIDを二重保存しない", () => {
  const folder = mkdtempSync(join(tmpdir(), "quest-notebook-test-"));
  const file = join(folder, "test.sqlite");
  const entry: NotebookEntry = { id: "one", at: "2026-09-20T00:00:00Z", hypothesis: "型は関係ある？", kind: "question", answer: "場合による", cases: ["L5", "L6"], interpretation: { kind: "question", topic: "types", needsKind: false, needsTopic: false, kindProbabilities: { question: 0.95, assertion: 0.03, other: 0.02 }, reading: { rule: 0.1, form: 0.1, order: 0.1, types: 0.9, singleFast: 0.1, typed: 0.1 } } };
  let db = openNotebook(file);
  try {
    db.append("session-a", entry); db.append("session-a", entry);
    db.append("session-b", { ...entry, hypothesis: "別の人の入力" });
    assert.deepEqual(db.list("session-a"), [entry]);
    assert.deepEqual(db.list("' OR 1=1 --"), []);
    db.close(); db = openNotebook(file);
    assert.deepEqual(db.list("session-a"), [entry]);
    assert.equal(db.list("session-b")[0].hypothesis, "別の人の入力");
  } finally { db.close(); rmSync(file); rmdirSync(folder); }
});

test("提出は別セッションに漏れず、再送は同じ保存結果を返す", () => {
  const store = openNotebook(":memory:");
  const submission: Submission = { id: "same-request", at: "2026-09-20T00:00:00Z", hypothesis: "同じ引数なら記憶を返す", review: "確認したい", decision: "hold", reading: null, ...reviewCheck(null, []), narration: { text: "定型文", source: "fallback", reason: "unavailable" } };
  try {
    assert.deepEqual(store.submit("a", submission), submission);
    assert.deepEqual(store.submit("a", { ...submission, review: "上書きしない" }), submission);
    assert.equal(store.submissions("a").length, 1);
    assert.deepEqual(store.submissions("b"), []);
  } finally { store.close(); }
});
