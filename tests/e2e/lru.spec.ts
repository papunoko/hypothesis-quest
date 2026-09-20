import { test, expect } from "@playwright/test";
import { LRU_CASES, type LruReading } from "../../src/subject/lru";
import { judgeLru, nextLru } from "../../src/lib/lru-select";
const base: LruReading = { rule: 0.98, form: 0.02, order: 0.02, types: 0.02, singleFast: 0.02, typed: 0.02 };

test("イシュー・実際のPR・関数の説明から始まり、PCとスマホで読める", async ({ page }, info) => {
  let requests = 0;
  page.on("request", (r) => { if (r.url().includes("/api/")) requests++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /この修正、マージしていい？/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "bpo-39554" })).toHaveAttribute("href", "https://bugs.python.org/issue39554");
  await expect(page.getByText("このPRは演習用の架空の提案です。")).toBeVisible();
  await page.screenshot({ path: info.outputPath("intro-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("intro-mobile.png"), fullPage: true });
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await expect(page.getByRole("heading", { name: "まったく同じ呼び出し" })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect(page.getByRole("meter")).toHaveCount(0);
});

test("仮説でL2→L5→L6へ分岐し、1個と2個を並べてコードへ戻れる", async ({ page }, info) => {
  await page.route("**/api/read", (route) => route.fulfill({ json: { reading: base } }));
  await page.route("**/api/predict", async (route) => {
    const { hypothesis, shown, subject } = route.request().postDataJSON();
    expect(subject).toBe("lru");
    const reading = { ...base, form: hypothesis.includes("書き方") ? 0.98 : 0.02, order: hypothesis.includes("順番") ? 0.98 : 0.02, types: hypothesis.includes("型") ? 0.98 : 0.02 };
    const results = LRU_CASES.map((c) => judgeLru(c, reading));
    const next = nextLru(results, new Set(shown));
    await route.fulfill({ json: { reading, results, next: next?.id ?? null } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  for (const [hypothesis, title] of [
    ["同じ引数で呼べば記憶を返す", "省略していた0を書く"],
    ["引数の書き方と順番まで同じなら記憶を返す", "1個の引数：1を1.0にする"],
    ["引数の書き方と順番と型まで同じなら記憶を返す", "2個の引数：1を1.0にする"],
  ]) {
    await page.getByRole("textbox").fill(hypothesis);
    await page.getByRole("button", { name: "この仮説で次の例を探す →" }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.locator(".contrast-pair")).toContainText("もう一度計算する");
  await expect(page.locator(".contrast-pair")).toContainText("記憶した結果を返す");
  await page.getByText("根拠を見る：イシューと実装のどこ？", { exact: true }).click();
  await expect(page.getByRole("link", { name: "CPython 3.12.3の該当行 ↗" })).toHaveAttribute("href", /functools.py#L/);
  await page.screenshot({ path: info.outputPath("lru-comparison.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lru-mobile.png"), fullPage: true });
});

test("ライブ読み取りはIME中に送らず、古い応答を表示しない", async ({ page }) => {
  const texts: string[] = [];
  await page.route("**/api/read", async (route) => {
    const { hypothesis } = route.request().postDataJSON(); texts.push(hypothesis);
    if (hypothesis === "最初の仮説") await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ json: { reading: { ...base, form: hypothesis === "新しい仮説" ? 0.95 : 0.05 } } }).catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  const textbox = page.getByRole("textbox");
  await textbox.dispatchEvent("compositionstart");
  await textbox.fill("変換中の仮説");
  await page.waitForTimeout(550); // Must exceed the 400ms debounce to prove no request.
  expect(texts).toEqual([]);
  await textbox.dispatchEvent("compositionend");
  await expect.poll(() => texts.length).toBe(1);
  await textbox.fill("最初の仮説");
  await expect.poll(() => texts.includes("最初の仮説")).toBe(true);
  await textbox.fill("新しい仮説");
  await page.getByText("読み取りの内訳", { exact: true }).click(); // 内訳は折りたたみ。開いてから棒を見る
  await expect(page.getByRole("meter", { name: "省略・位置・名前の書き方を区別する" })).toHaveAttribute("aria-valuenow", "0.95");
  await page.waitForTimeout(850); // Old response has now arrived or been aborted.
  await expect(page.getByRole("meter", { name: "省略・位置・名前の書き方を区別する" })).toHaveAttribute("aria-valuenow", "0.95");
});

test("Jev障害時も観察でき、L8は別論点、7例で終了し再開できる", async ({ page }) => {
  await page.route("**/api/read", (route) => route.fulfill({ status: 502, json: { error: "offline" } }));
  await page.route("**/api/predict", (route) => route.fulfill({ status: 502, json: { error: "接続できません" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "このイシューを確かめる →" }).click();
  await page.getByRole("textbox").fill("同じ引数で呼べば記憶を返す");
  await page.getByRole("button", { name: "この仮説で次の例を探す →" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "接続できません" })).toBeVisible();
  for (const c of LRU_CASES.slice(1)) {
    await page.getByRole("button", { name: "仮説なしで、次の事例を観察する" }).click();
    await expect(page.getByRole("heading", { name: c.title, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "L8 リストを渡すと？（別の論点）" }).click();
  await expect(page.getByText(/TypeError: unhashable/)).toBeVisible();
  await page.getByRole("button", { name: "事例の確認を終える" }).click();
  await expect(page.getByRole("heading", { name: "7つの事例を見終えました。" })).toBeVisible();
  await page.getByRole("textbox", { name: "あなたのレビューコメント（下書き・外部には投稿されません）" }).fill("追加の検証が必要だと思います。");
  await page.getByText("実際のメンテナの返答と比べる", { exact: true }).click();
  await expect(page.getByRole("link", { name: "実際の議論を読む ↗" })).toBeVisible();
  await page.getByRole("button", { name: "この仮説でもう一周する" }).click();
  await expect(page.getByRole("heading", { name: "まったく同じ呼び出し" })).toBeVisible();
});
