import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSignals, shouldOffer, summarizeSignals, SUPPORT_QUESTIONS, type SupportSignals } from "./support.ts";

const base: SupportSignals = { secondsOnCase: 48, secondsSinceInput: 48, inputChars: 0, scrollCount: 2, scrollDepth: 0.3, pointerMoves: 12, casesSeen: 2, submissions: 0, readingReady: false, focused: true };

test("シグナルは数と真偽値だけを受け、範囲外は端に丸める", () => {
  const clean = sanitizeSignals({ ...base, secondsOnCase: 99_999, scrollDepth: -1, inputChars: 12.345 });
  assert.equal(clean.secondsOnCase, 3600); assert.equal(clean.scrollDepth, 0); assert.equal(clean.inputChars, 12.35);
  for (const broken of [null, "x", { ...base, inputChars: "12" }, { ...base, focused: 1 }, { ...base, secondsOnCase: NaN }, { ...base, pointerMoves: undefined }]) assert.throws(() => sanitizeSignals(broken));
  assert.equal(Object.keys(sanitizeSignals({ ...base, hypothesis: "秘密" })).includes("hypothesis"), false);
});

test("要約は入力文を含まず、数を事実文にする", () => {
  const empty = summarizeSignals(base);
  assert.match(empty, /Nothing has been typed/); assert.match(empty, /48s since the current card appeared/); assert.match(empty, /2 of 7 cases seen/);
  const typed = summarizeSignals({ ...base, inputChars: 14, secondsSinceInput: 20, readingReady: true });
  assert.match(typed, /14 characters/); assert.match(typed, /confirmed 20s ago/); assert.match(typed, /reading of the current sentence is ready/);
  assert.doesNotMatch(typed, /Nothing has been typed/);
});

test("出すかどうかは閾値で決め、迷いは出さないに倒す", () => {
  assert.equal(shouldOffer({ kind: "start", confidence: 0.8, paused: 0.9 }, base), true);
  assert.equal(shouldOffer({ kind: "none", confidence: 0.9, paused: 0.9 }, base), false);
  assert.equal(shouldOffer({ kind: "start", confidence: 0.45, paused: 0.9 }, base), false);
  assert.equal(shouldOffer({ kind: "send", confidence: 0.9, paused: 0.5 }, base), false);
  // 探し中の助け舟だけは、事例表示から1分待つ（読み進めている最中に出さない）
  assert.equal(shouldOffer({ kind: "explore", confidence: 0.95, paused: 0.8 }, { ...base, secondsOnCase: 30 }), false);
  assert.equal(shouldOffer({ kind: "explore", confidence: 0.95, paused: 0.8 }, { ...base, secondsOnCase: 75 }), true);
});

test("問いは summary だけを見て、入力文の内容には触れない", () => {
  for (const question of Object.values(SUPPORT_QUESTIONS)) {
    const text = [question.instructions, ...Object.values(question.criteria)].join(" ");
    assert.match(question.instructions, /`summary`/); assert.doesNotMatch(text, /hypothesis|types?|order|型|順番/);
  }
});
