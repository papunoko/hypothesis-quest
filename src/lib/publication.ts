export const PUBLICATION_END = "2026-10-01T00:00:00+09:00";

export function publicationEnded(until: string | undefined, now = Date.now()) {
  const end = until ? Date.parse(until) : NaN;
  // Missing or invalid configuration must never accidentally reopen the demo.
  return !Number.isFinite(end) || now >= end;
}

export function closedResponse(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return Response.json({ error: "公開期間は終了しました。ご利用ありがとうございました。" }, { status: 410, headers });
  }
  return new Response(request.method === "HEAD" ? null : "<!doctype html><html lang=ja><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>公開終了 — 仮説クエスト</title><main><h1>公開期間は終了しました</h1><p>仮説クエストの公開は2026年9月30日をもって終了しました。ご利用ありがとうございました。</p></main></html>", { status: 410, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };
export type PublicationEnv = { PUBLIC_UNTIL?: string; READ_LIMITER?: Limiter; AI_LIMITER?: Limiter };

export async function publicationGate(request: Request, env: PublicationEnv, now = Date.now()) {
  if (publicationEnded(env.PUBLIC_UNTIL, now)) return closedResponse(request);
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.startsWith("/api/")) return null;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return Response.json({ error: "別サイトからは送信できません。" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const limiter = url.pathname === "/api/read" ? env.READ_LIMITER : env.AI_LIMITER;
  try {
    if (!limiter) throw new Error("Rate limiter binding missing");
    const { success } = await limiter.limit({ key: request.headers.get("CF-Connecting-IP") || "local" });
    if (!success) return Response.json({ error: "短時間の利用回数を超えました。1分ほど待って再試行してください。" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  } catch {
    return Response.json({ error: "現在受付できません。しばらくして再試行してください。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}
