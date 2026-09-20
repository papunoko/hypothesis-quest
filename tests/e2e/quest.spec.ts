import { test, expect } from "@playwright/test";
import { CASES } from "../../src/subject/cases";
import { judge, pickNext } from "../../src/lib/select";

test("仮説を修正してC3からC4へ進み、履歴を残す", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/predict", async (route) => {
    const { hypothesis, shown } = route.request().postDataJSON();
    const reading = { sameContent: hypothesis.includes("商品") ? 0.95 : 0.02,
      sameKey: hypothesis.includes("依頼ID") ? 0.95 : 0.02, retry: 0.02, rejectConflict: 0.02 };
    const results = CASES.map((c) => judge(c, reading));
    const { next, reason } = pickNext(results, new Set(shown));
    await route.fulfill({ json: { reading, results, next: next?.id ?? null, reason } });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "この仮説で試す", exact: true })).toBeDisabled();
  await page.getByRole("textbox").fill("同じ商品は重複して登録しない");
  await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
  await expect(page.getByRole("heading", { name: "意図して2件目を注文", exact: true })).toBeVisible();
  await page.getByRole("textbox").fill("同じ依頼IDなら、登録は1件のまま");
  await page.getByRole("textbox").press("Control+Enter");
  await expect(page.getByRole("heading", { name: "同じ依頼IDで中身が違う", exact: true })).toBeVisible();
  await expect(page.locator("ol")).toContainText("C3 食い違い");
  await expect(page.locator("ol")).toContainText("C4 食い違い");
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("c4-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("c4-mobile.png"), fullPage: true });
});

test("弱い読み取りを食い違いと断定しない", async ({ page }) => {
  await page.route("**/api/predict", (route) => route.fulfill({ json: {
    reading: null, next: "C3", reason: "undetermined",
    results: [{ id: "C3", prediction: "same", confidence: 0, verdict: "undetermined" }],
  } }));
  await page.goto("/");
  await page.getByRole("textbox").fill("仮説");
  await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
  await expect(page.getByText("解釈の確認:", { exact: false })).toBeVisible();
  await expect(page.locator("ol")).not.toContainText("食い違い");
});

test("全事例を表示しても全て説明できたと断定せず、再開できる", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/predict", async (route) => {
    calls++;
    const { shown } = route.request().postDataJSON();
    const next = CASES.find((c) => !shown.includes(c.id));
    await route.fulfill({ json: { reading: null, next: next?.id ?? null,
      reason: next ? "mismatch" : "exhausted",
      results: CASES.map((c) => ({ id: c.id, prediction: "same", confidence: 0.9, verdict: "mismatch" })),
    } });
  });
  await page.goto("/");
  await page.getByRole("textbox").fill("間違いの残る仮説");
  for (const c of CASES) {
    await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
    await expect(page.getByRole("heading", { name: c.title, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
  await expect(page.getByRole("heading", { name: "用意した6事例を見終えました。" })).toBeVisible();
  await expect(page.locator("ol")).not.toContainText("すべて説明できた");
  await page.getByRole("textbox").press("Control+Enter");
  await expect(page.getByRole("button", { name: "この仮説で試す", exact: true })).toBeDisabled();
  expect(calls).toBe(7);
  await page.getByRole("button", { name: "この仮説でもう一度試す" }).click();
  await expect(page.getByRole("button", { name: "この仮説で試す", exact: true })).toBeEnabled();
  await expect(page.locator(".scope")).toContainText("事例 0/6");
});

test("API失敗時にも6事例の実結果を見て終了できる", async ({ page }) => {
  await page.route("**/api/predict", (route) => route.fulfill({ status: 502, json: { error: "test unavailable" } }));
  await page.goto("/");
  await page.getByRole("textbox").fill("仮説");
  for (const c of CASES) {
    await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
    await page.getByRole("button", { name: "予想なしで次の事例を開く" }).click();
    await expect(page.getByRole("heading", { name: c.title, exact: true })).toBeVisible();
    await expect(page.getByText("Jev に接続できなかったため予想なしで表示しています。", { exact: false })).toBeVisible();
  }
  await page.getByRole("button", { name: "確認を終える" }).click();
  await expect(page.getByRole("heading", { name: "用意した6事例を見終えました。" })).toBeVisible();
});
