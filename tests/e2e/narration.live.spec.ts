import { test, expect } from "@playwright/test";

test("実Jevで真相を提出するとクリアし、未提示事例に進める", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  await page.getByLabel("最後の仮説（現状の実装をどう説明する？）").fill("引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵になる。typed=Trueでは型も区別する");
  await page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）").fill("現在の7事例を確認しました。変更後の性能は追加検証が必要です。");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  const holdout = page.getByRole("region", { name: "未提示事例の予想" });
  await expect(holdout).toBeVisible({ timeout: 40000 });
  await holdout.getByRole("button", { name: "記憶した結果を返す", exact: true }).click();
  await expect(holdout.getByRole("status")).toContainText("予想と実測が一致しました");
  const saved = (await (await page.request.get("/api/review")).json()).submissions;
  expect(saved).toHaveLength(1);
  expect(saved[0].cleared).toBe(true);
  expect(saved[0].results).toHaveLength(7);
});

test("実LLMの質問回答・ヒント・最終提出の解説を検問し保存復元する", async ({ page, browser }, info) => {
  test.setTimeout(90000);
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("型は関係ある？");
  await page.getByRole("button", { name: /この(仮説で次の例を探す|質問で調べる)/ }).click();
  const answer = page.getByRole("article", { name: "質問への返答" });
  await expect(answer.getByText("LLM生成 · Jev検問通過", { exact: true })).toBeVisible({ timeout: 35000 });
  await page.getByRole("button", { name: "理由も知りたい（答えに近づくヒント）" }).click();
  await expect(answer.getByRole("region", { name: "相棒の回答" })).toHaveCount(2, { timeout: 35000 });
  await page.screenshot({ path: info.outputPath("llm-question-live.png"), fullPage: true });
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  await page.getByLabel("最後の仮説（現状の実装をどう説明する？）").fill("型が違えば常に別の呼び出しになる");
  await page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）").fill("型が違えば別だと思っていましたがL6の結果が説明できません。追加検証を依頼します。");
  await page.getByLabel("このPRへの判断").selectOption("changes");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  const receipt = page.getByRole("status", { name: "提出への回答" });
  await expect(receipt.getByText("LLM生成 · Jev検問通過", { exact: true })).toBeVisible({ timeout: 35000 });
  await expect(receipt).not.toContainText("用意した7事例では、読み取った説明と実測が一致しました");
  const saved = (await (await page.request.get("/api/review")).json()).submissions;
  expect(saved).toHaveLength(1); expect(saved[0].narration.source).toBe("generated");
  const duplicate = await page.request.post("/api/review", { data: { ...saved[0], requestId: saved[0].id } });
  expect(duplicate.status()).toBe(200);
  expect((await (await page.request.get("/api/review")).json()).submissions).toHaveLength(1);
  const isolated = await browser.newContext();
  try {
    expect((await (await isolated.request.get(new URL("/api/review", page.url()).href)).json()).submissions).toEqual([]);
    const entries = (await (await page.request.get("/api/notebook")).json()).entries;
    expect((await isolated.request.post(new URL("/api/explain", page.url()).href, { data: { entryId: entries[0].id } })).status()).toBe(404);
  } finally { await isolated.close(); }
  expect((await page.request.post("/api/review", { data: { hypothesis: "" } })).status()).toBe(400);
  expect((await page.request.post("/api/review", { headers: { Origin: "https://unrelated.example" }, data: {} })).status()).toBe(403);
  expect((await page.request.post("/api/review", { data: { ...saved[0], review: "別の内容", requestId: saved[0].id } })).status()).toBe(409);
  await page.screenshot({ path: info.outputPath("llm-review-live.png"), fullPage: true });
  await page.reload(); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "提出したレビューと回答を見る" }).click();
  await page.getByText("保存した提出履歴 · 1件", { exact: true }).click();
  await page.getByRole("button", { name: /の回答を見直す/ }).click();
  await expect(page.getByRole("heading", { name: "レビューを受け付けました" })).toBeVisible();
  // A completed review is not the end of questioning, nor a notebook reset.
  await page.getByRole("button", { name: "質問・観察を続ける" }).click();
  await page.getByRole("textbox").fill("書き方は関係ある？");
  await expect(page.getByLabel("入力の種別")).toHaveText("質問", { timeout: 25000 });
  await page.getByRole("button", { name: "この質問で調べる →" }).click();
  await expect(page.getByRole("article", { name: "質問への返答" })).toContainText("はい", { timeout: 35000 });
  await expect(page.locator(".notebook")).toContainText("型は関係ある？");
  await page.getByRole("button", { name: "提出したレビューと回答を見る" }).click();
  await expect(page.getByRole("heading", { name: "レビューを受け付けました" })).toBeVisible();

  // Rotation loses access from this browser, but does not delete the old D1 records.
  const previousCookies = await page.context().cookies();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "新しいセッションを始める" }).click();
  await expect(page.getByRole("button", { name: "このイシューを確かめる →" })).toBeVisible();
  expect((await (await page.request.get("/api/notebook")).json()).entries).toEqual([]);
  expect((await (await page.request.get("/api/review")).json()).submissions).toEqual([]);
  const oldSession = await browser.newContext();
  try {
    await oldSession.addCookies(previousCookies);
    expect((await (await oldSession.request.get(new URL("/api/review", page.url()).href)).json()).submissions).toHaveLength(1);
    expect((await (await oldSession.request.get(new URL("/api/notebook", page.url()).href)).json()).entries).toHaveLength(2);
  } finally { await oldSession.close(); }
});
