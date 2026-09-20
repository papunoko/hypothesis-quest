import { test, expect } from "@playwright/test";

// 明示的に npm run test:e2e:live を実行したときだけ、実際のJev APIを呼ぶ。
test("実Jevで商品→C3、依頼ID→C4に分岐する", async ({ page }, info) => {
  await page.goto("/");
  for (const [hypothesis, title] of [
    ["同じ商品は重複して登録しない", "意図して2件目を注文"],
    ["同じ依頼IDなら、登録は1件のまま", "同じ依頼IDで中身が違う"],
  ]) {
    await page.getByRole("textbox").fill(hypothesis);
    const response = page.waitForResponse("**/api/predict");
    await page.getByRole("button", { name: "この仮説で試す", exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    expect((await result.json()).reason).toBe("mismatch");
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(".verdict.mismatch")).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath("jev-live-c4.png"), fullPage: true });
});
