import { test, expect } from "@playwright/test";
import { answerQuestion } from "../../src/subject/lru-questions";
const reading = { rule: 0.1, form: 0.1, order: 0.1, types: 0.9, singleFast: 0.1, typed: 0.1 };

test("質問の鏡と場合によるの比較は、未入力の軸を見せない", async ({ page }, info) => {
  await page.route("**/api/read", (route) => route.fulfill({ json: { reading, kind: "question", topic: "types" } }));
  await page.route("**/api/predict", (route) => route.fulfill({ json: { reading, kind: "question", question: answerQuestion("types"), results: [], next: null } }));
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("型は関係ある？");
  await expect(page.getByLabel("入力の種別")).toHaveText("質問");
  await expect(page.getByRole("meter")).toHaveCount(0);
  await expect(page.locator(".reading-preview")).not.toContainText("個数");
  await page.getByRole("button", { name: "この質問で調べる →" }).click();
  const answer = page.getByRole("article", { name: "質問への返答" });
  await expect(answer.getByText("場合による", { exact: true })).toBeVisible();
  await expect(answer.locator(".question-cases section")).toHaveCount(2);
  await expect(answer).toContainText("もう一度計算する"); await expect(answer).toContainText("記憶した結果を返す");
  await page.screenshot({ path: info.outputPath("question-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("question-mobile.png"), fullPage: true });
});

test("曖昧な種別は本人が選べる・未検証の質問を反証にしない", async ({ page }) => {
  await page.route("**/api/read", (route) => route.fulfill({ json: { reading, kind: "question", needsKind: true } }));
  await page.route("**/api/predict", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({ json: body.kind ? { reading, kind: body.kind, question: answerQuestion("unsupported"), results: [], next: null } : { reading, clarify: true } });
  });
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("型だと思うけどf(True)はどうなる？");
  await page.getByRole("button", { name: /この(仮説で次の例を探す|質問で調べる)/ }).click();
  await page.getByRole("button", { name: "質問として調べる", exact: true }).click();
  await expect(page.getByRole("article", { name: "質問への返答" })).toContainText("まだ答えられません");
  await expect(page.locator(".reading-verdict.mismatch")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /事例を見終えました/ })).toHaveCount(0);
});
