import { test, expect } from "@playwright/test";
import type { LruReading } from "../../src/subject/lru";
const base: LruReading = { rule: 0.98, form: 0.02, order: 0.02, types: 0.02, singleFast: 0.02, typed: 0.02 };

test("止まり方から助け舟を出し、入力文は送らず、候補を入れられる", async ({ page }) => {
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/read", (route) => {
    const { hypothesis } = route.request().postDataJSON();
    return route.fulfill({ json: { reading: { ...base, types: hypothesis.includes("型") ? 0.9 : 0.02 }, kind: hypothesis.endsWith("？") ? "question" : "assertion", topic: "types" } });
  });
  await page.route("**/api/support", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { kind: "start", confidence: 0.8, paused: 0.9, offer: true } });
  });
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await expect(page.getByRole("heading", { name: "まったく同じ呼び出し" })).toBeVisible();
  // 最初から助け舟もヘルプ本文も出さない。種別チップと核心度は空の状態
  await expect(page.getByRole("status", { name: "助け舟" })).toHaveCount(0);
  await expect(page.getByText("何を書けばいいかわからない？")).toHaveCount(0);
  await expect(page.getByLabel("入力の種別")).toHaveText("—");
  await expect(page.getByLabel("核心度")).toContainText("0.0");
  await page.clock.runFor(10_000);
  expect(calls).toEqual([]); // 事例表示から15秒は問い合わせない
  await page.clock.runFor(11_000);
  await expect(page.getByRole("status", { name: "助け舟" })).toBeVisible();
  expect(calls).toHaveLength(1);
  const signals = calls[0].signals as Record<string, unknown>;
  expect(signals).toMatchObject({ inputChars: 0, casesSeen: 1, submissions: 0, readingReady: false });
  expect(JSON.stringify(calls[0])).not.toMatch(/hypothesis/);
  await expect(page.getByText("何を書けばいいかわからない？")).toBeVisible();
  await page.getByRole("button", { name: "こんなのは？（別の候補）" }).click();
  await page.getByRole("button", { name: "これを入れてみる" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("書き方まで同じなら記憶を返す");
  await expect(page.getByRole("status", { name: "助け舟" })).toHaveCount(0);
  await page.clock.runFor(600);
  await expect(page.getByLabel("入力の種別")).toHaveText("仮説");
  await expect(page.getByLabel("核心度")).toContainText("0.0");
  await page.getByRole("textbox").fill("型が違えば別の呼び出しになる");
  await page.clock.runFor(600);
  await expect(page.getByLabel("核心度")).toContainText("0.9");
  await page.getByRole("textbox").fill("型は関係ある？");
  await page.clock.runFor(600);
  await expect(page.getByLabel("入力の種別")).toHaveText("質問");
  await expect(page.getByRole("meter")).toHaveCount(0);
});

test("ヒントは自分でも開け、閉じた種別は同じ事例では再表示しない", async ({ page }) => {
  let kind = "stuck";
  await page.route("**/api/read", (route) => route.fulfill({ json: { reading: base, kind: "assertion" } }));
  await page.route("**/api/support", (route) => route.fulfill({ json: { kind, confidence: 0.9, paused: 0.9, offer: true } }));
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "ヒント" }).click();
  await expect(page.getByText("何を書けばいいかわからない？")).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("textbox").fill("同じ引数で");
  await page.getByRole("button", { name: "ヒント" }).click();
  await expect(page.getByText("途中で止まっていますか？")).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("status", { name: "助け舟" })).toHaveCount(0);
  await page.clock.runFor(60_000); // stuck は閉じたので Jev が同じ種別を返しても出さない
  await expect(page.getByRole("status", { name: "助け舟" })).toHaveCount(0);
  kind = "send";
  await page.clock.runFor(30_000);
  await expect(page.getByText("この一文で試してみますか？")).toBeVisible();
  await page.getByRole("textbox").fill("同じ引数で呼べば");
  await expect(page.getByRole("status", { name: "助け舟" })).toHaveCount(0); // 文が変わったら送信の後押しは消す
  await expect(page.getByRole("button", { name: "観察を区切ってレビューを書く" })).toHaveClass(/ghost/);
});
