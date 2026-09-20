import { test, expect } from "@playwright/test";

test("新しいセッションは確認・取消でき、Cookieだけ切り替えて最初に戻る", async ({ page, context, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  const reset = page.getByRole("button", { name: "新しいセッションを始める" });
  await expect(reset).toBeEnabled();
  const previous = (await context.cookies()).find((cookie) => cookie.name === "quest-session-3002")!;
  expect(previous).toBeTruthy();
  await context.addCookies([{ name: "unrelated-test-cookie", value: "preserve", url: page.url() }]);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("サーバーに保存済みのデータは削除しません");
    await dialog.dismiss();
  });
  await reset.click();
  expect((await context.cookies()).find((cookie) => cookie.name === previous.name)?.value).toBe(previous.value);
  await expect(page.getByRole("heading", { name: "何が「同じ」を分けている？" })).toBeVisible();

  // Only same-origin POST can rotate the session. GET is not a reset action.
  const endpoint = new URL("/api/session", page.url()).href;
  for (const origin of [undefined, "https://example.invalid"]) {
    const response = await request.post(endpoint, { headers: origin ? { origin } : {} });
    expect(response.status()).toBe(403);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  expect((await request.get(endpoint)).status()).toBe(405);

  page.once("dialog", (dialog) => dialog.accept());
  await reset.click();
  await expect(page.getByRole("button", { name: "このイシューを確かめる →" })).toBeVisible();
  const cookies = await context.cookies();
  const next = cookies.find((cookie) => cookie.name === previous.name)!;
  expect(next.value).not.toBe(previous.value);
  expect(next.httpOnly).toBe(true);
  expect(next.sameSite).toBe("Strict");
  expect(next.path).toBe("/");
  expect(cookies.find((cookie) => cookie.name === "unrelated-test-cookie")?.value).toBe("preserve");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await expect(page.locator(".notebook ol li")).toHaveCount(0);
});

test("セッション切替失敗では現在の入力を残す", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ status: 503, json: { error: "切り替えを受け付けられません。" } }));
  await page.route("**/api/read", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("書きかけの質問です");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "新しいセッションを始める" }).click();
  await expect(page.locator(".session-controls").getByRole("alert")).toContainText("切り替えを受け付けられません");
  await expect(page.getByRole("textbox")).toHaveValue("書きかけの質問です");
  await expect(page.getByRole("textbox")).toBeEnabled();
});
