import { test, expect } from "@playwright/test";
import { reviewCheck } from "../../src/lib/review";
import { answerQuestion } from "../../src/subject/lru-questions";
const reading = { rule: .99, form: .99, order: .99, types: .01, singleFast: .99, typed: .99 };

for (const width of [1440, 390]) test(`提出後も質問を続け、下書き・判断・提出回答を残してレビューに戻れる (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route("**/api/notebook", (route) => route.fulfill({ json: { entries: [] } }));
  await page.route("**/api/read", (route) => route.fulfill({ json: { reading, kind: "question", topic: "types" } }));
  await page.route("**/api/predict", (route) => route.fulfill({ json: { reading, kind: "question", question: answerQuestion("types"), results: [], next: null } }));
  await page.route("**/api/review", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { submissions: [] } });
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { submission: { ...body, id: body.requestId, at: new Date().toISOString(), reading, ...reviewCheck(reading, []), narration: { source: "fallback", text: "実測を確認してください。" } } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  const hypothesis = page.getByLabel("最後の仮説（現状の実装をどう説明する？）");
  const review = page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）");
  await hypothesis.fill("同じ引数で呼べば記憶を返す");
  await review.fill("追加の確認をお願いします。");
  await page.getByLabel("このPRへの判断").selectOption("changes");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  await expect(page.getByRole("heading", { name: "レビューを受け付けました" })).toBeVisible();
  await review.fill("提出後にも追記している下書きです。");
  await page.getByRole("button", { name: "質問・観察を続ける" }).click();
  await expect(page.locator(".section-heading")).toContainText("1 / 7 事例");
  await expect(page.getByRole("textbox")).toBeEnabled();
  await expect(page.getByRole("region", { name: "最終レビュー提出" })).toBeHidden();
  await page.getByRole("textbox").fill("型は関係ある？");
  await expect(page.getByLabel("入力の種別")).toHaveText("質問");
  await page.getByRole("button", { name: "この質問で調べる →" }).click();
  await expect(page.getByRole("article", { name: "質問への返答" })).toContainText("場合による");
  await page.getByRole("button", { name: "提出したレビューと回答を見る" }).click();
  await expect(review).toHaveValue("提出後にも追記している下書きです。");
  await expect(hypothesis).toHaveValue("同じ引数で呼べば記憶を返す");
  await expect(page.getByLabel("このPRへの判断")).toHaveValue("changes");
  await expect(page.getByRole("heading", { name: "レビューを受け付けました" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("最終提出を明示し、生成回答とコード照合を分けて表示する", async ({ page }, info) => {
  let submitted: Record<string, string> | undefined;
  await page.route("**/api/review", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { submissions: [] } });
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { submission: { ...submitted, id: submitted!.requestId, at: "2026-09-20T08:00:00Z", reading, ...reviewCheck(reading, []), narration: { source: "generated", model: "test", text: "用意した7事例の範囲で一致しています。変更後の性能は未検証です。" } } } });
  });
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  await page.getByLabel("最後の仮説（現状の実装をどう説明する？）").fill("引数の並びを鍵にする。単一のint/strには特例がありtyped=Trueでは型も含む。");
  await page.getByLabel("このPRへの判断").selectOption("changes");
  await page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）").fill("近道を外した後のメモリ使用量も確認してほしいです。");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  await expect(page.getByRole("heading", { name: "レビューを受け付けました" })).toBeVisible();
  await expect(page.getByText("LLM生成 · Jev検問通過", { exact: true })).toBeVisible();
  await expect(page.getByText("用意した7事例では、読み取った説明と実測が一致しました。確認範囲はこの7つだけです。")).toBeVisible();
  expect(submitted!.decision).toBe("changes"); expect(submitted!.requestId).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByText("この提出の照合と根拠を見る", { exact: true }).click();
  await expect(page.locator(".review-results > div")).toHaveCount(7);
  await page.screenshot({ path: info.outputPath("review-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("review-mobile.png"), fullPage: true });
});

test("保存失敗でも入力を残し、再試行の同じIDと未確定・定型回答を表示する", async ({ page }) => {
  const ids: string[] = [];
  await page.route("**/api/review", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { submissions: [] } });
    const body = route.request().postDataJSON(); ids.push(body.requestId);
    if (ids.length === 1) return route.fulfill({ status: 503, json: { error: "保存できませんでした。" } });
    return route.fulfill({ json: { submission: { ...body, id: body.requestId, at: new Date().toISOString(), reading: null, ...reviewCheck(null, []), narration: { source: "fallback", reason: "screened", text: "実測を確認してください。" } } } });
  });
  await page.goto("/"); await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  await page.getByLabel("最後の仮説（現状の実装をどう説明する？）").fill("同じ引数で呼べば記憶を返す");
  const review = page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）"); await review.fill("まだ確認が必要です。");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  await expect(page.getByRole("region", { name: "最終レビュー提出" }).getByRole("alert")).toContainText("保存できませんでした"); await expect(review).toHaveValue("まだ確認が必要です。");
  await page.getByRole("button", { name: "レビューを提出して回答を受け取る" }).click();
  await expect(page.getByText("定型回答 · 生成文は未表示", { exact: true })).toBeVisible();
  await expect(page.getByText("読み取りができず、照合は未確定です。", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "未提示事例の予想" })).toHaveCount(0);
  expect(ids[0]).toBe(ids[1]);
});

test("クリア後の未提示事例は予想を選んでから実測を出し、保存・送信しない", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/review", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { submissions: [] } });
    posts++;
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { submission: { ...body, id: body.requestId, at: new Date().toISOString(), reading, ...reviewCheck(reading, []), narration: { source: "fallback", reason: "screened", text: "実測を確認してください。" } } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("button", { name: "観察を区切ってレビューを書く" }).click();
  const holdout = page.getByRole("region", { name: "未提示事例の予想" });
  await expect(holdout).toHaveCount(0);
  const hypothesis = page.getByLabel("最後の仮説（現状の実装をどう説明する？）");
  await hypothesis.fill("引数の並びを鍵にする。int・strが1個だけなら値自体。typed=Trueでは型も含む。");
  await page.getByLabel("あなたのレビューコメント（下書き・外部には投稿されません）").fill("性能の確認をお願いします。");
  const submit = page.getByRole("button", { name: "レビューを提出して回答を受け取る" });
  await submit.click();
  await expect(holdout).toBeVisible();
  await expect(holdout.locator("code")).toHaveText("f(1.0) → f(True)");
  await expect(holdout.getByRole("status")).toHaveCount(0);
  const unresolvedHoldout = page.locator(".unexplored").getByText("f(1.0)の後のf(True)はどうなる？", { exact: true });
  await expect(unresolvedHoldout).toBeVisible();
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) requests.push(request.url()); });
  await holdout.getByRole("button", { name: "もう一度計算する", exact: true }).click();
  await expect(holdout.getByRole("status")).toContainText("実測：記憶した結果を返す");
  await expect(holdout.getByRole("status")).toContainText("予想と実測が食い違いました");
  await expect(holdout.getByRole("button", { name: "記憶した結果を返す", exact: true })).toBeDisabled();
  expect(requests).toEqual([]);
  expect(posts).toBe(1);
  await expect(unresolvedHoldout).toHaveCount(0);
  await page.getByRole("button", { name: "質問・観察を続ける" }).click();
  await expect(unresolvedHoldout).toHaveCount(0);
  await page.getByRole("button", { name: "提出したレビューと回答を見る" }).click();
  await expect(holdout.getByRole("status")).toContainText("実測：記憶した結果を返す");
  // A new submission starts a fresh, unsaved prediction; it cannot inherit the previous reveal.
  await hypothesis.fill("引数の並びと単一int/strの特例、typed=Trueの型を区別する。");
  await submit.click();
  await expect(holdout.getByRole("status")).toHaveCount(0);
  await expect(unresolvedHoldout).toHaveCount(0); // A new submission cannot make an already-seen example unseen.
  await holdout.getByRole("button", { name: "記憶した結果を返す", exact: true }).click();
  await expect(holdout.getByRole("status")).toContainText("予想と実測が一致しました");
  await page.reload();
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await expect(unresolvedHoldout).toBeVisible(); // Seen state is deliberately not persisted.
});
