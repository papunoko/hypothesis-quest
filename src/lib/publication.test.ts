import test from "node:test";
import assert from "node:assert/strict";
import { PUBLICATION_END, publicationEnded, publicationGate } from "./publication.ts";

test("公開期限は日本時間10月1日0時、設定欠落も閉じる", () => {
  assert.equal(Date.parse(PUBLICATION_END), Date.parse("2026-09-30T15:00:00Z"));
  assert.equal(publicationEnded(PUBLICATION_END, Date.parse(PUBLICATION_END) - 1), false);
  assert.equal(publicationEnded(PUBLICATION_END, Date.parse(PUBLICATION_END)), true);
  assert.equal(publicationEnded(undefined), true);
  assert.equal(publicationEnded("invalid"), true);
});

test("終了後は画面・静的ファイル・APIすべて410で、課金処理へ進まない", async () => {
  for (const path of ["/", "/orders", "/_next/static/app.js", "/api/read", "/api/review"]) {
    const response = await publicationGate(new Request(`https://ebiharadev.org${path}`, { method: "POST" }), { PUBLIC_UNTIL: PUBLICATION_END, AI_LIMITER: { limit: async () => { throw new Error("must not run"); } } }, Date.parse(PUBLICATION_END));
    assert.equal(response?.status, 410);
    assert.equal(response?.headers.get("cache-control"), "no-store");
  }
});

test("公開中はAPIだけ制限し、超過429・検査障害503・他Origin403", async () => {
  const now = Date.parse(PUBLICATION_END) - 1000;
  const request = new Request("https://ebiharadev.org/api/read", { method: "POST" });
  const env = { PUBLIC_UNTIL: PUBLICATION_END, READ_LIMITER: { limit: async () => ({ success: true }) } };
  assert.equal(await publicationGate(request, env, now), null);
  assert.equal(await publicationGate(new Request("https://ebiharadev.org/"), env, now), null);
  assert.equal((await publicationGate(request, { ...env, READ_LIMITER: { limit: async () => ({ success: false }) } }, now))?.status, 429);
  assert.equal((await publicationGate(request, { PUBLIC_UNTIL: PUBLICATION_END }, now))?.status, 503);
  assert.equal((await publicationGate(new Request(request, { headers: { Origin: "https://elsewhere.example" } }), env, now))?.status, 403);
});
