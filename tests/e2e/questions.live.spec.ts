import { test, expect } from "@playwright/test";

test("実Jevの質問→D1帳面→再読込→レビューと、他ブラウザとの分離", async ({ page, browser }, info) => {
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("型は関係ある？");
  await expect(page.getByLabel("入力の種別")).toHaveText("質問", { timeout: 25000 });
  await page.getByRole("button", { name: "この質問で調べる →" }).click();
  await expect(page.getByRole("article", { name: "質問への返答" })).toContainText("場合による", { timeout: 25000 });
  await expect(page.locator(".notebook")).toContainText("型は関係ある？");
  await page.reload(); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await expect(page.locator(".notebook")).toContainText("型は関係ある？");
  await expect(page.locator(".notebook")).toContainText("場合による");
  const isolated = await browser.newContext();
  try {
    const response = await isolated.request.get(new URL("/api/notebook", page.url()).href);
    expect((await response.json()).entries).toEqual([]);
  } finally { await isolated.close(); }
  await page.getByRole("textbox").fill("同じ引数で呼べば記憶を返す");
  await page.getByRole("button", { name: "この仮説で次の例を探す →" }).click();
  await expect(page.getByRole("heading", { name: "省略していた0を書く" })).toBeVisible({ timeout: 25000 });
  await expect(page.locator(".notebook li").filter({ hasText: "同じ引数で呼べば記憶を返す" })).toContainText("予想と食い違い");
  await page.screenshot({ path: info.outputPath("notebook-live.png"), fullPage: true });
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  await expect(page.getByRole("textbox", { name: /あなたのレビューコメント/ })).toContainText("同じ引数で呼べば記憶を返す");
});
