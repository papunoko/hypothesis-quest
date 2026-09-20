import { test, expect } from "@playwright/test";
test("実Jevで題材2の仮説を書き換えるとL2→L5へ進む", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  for (const [hypothesis, title] of [
    ["同じ引数で呼べば記憶を返す", "省略していた0を書く"],
    ["引数の書き方（位置・キーワード・順番）まで同じなら計算しない", "1個の引数：1を1.0にする"],
  ]) {
    await page.getByRole("textbox").fill(hypothesis);
    const response = page.waitForResponse("**/api/predict");
    await page.getByRole("button", { name: "この仮説で次の例を探す →" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(".reading-verdict.mismatch")).toBeVisible();
  }
  await page.getByRole("button", { name: "L6「2個の引数：1を1.0にする」も見る" }).click();
  await expect(page.locator(".contrast-pair")).toBeVisible();
  await page.screenshot({ path: info.outputPath("lru-live.png"), fullPage: true });
});
