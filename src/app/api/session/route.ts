import { notebookSession, sameOrigin } from "@/lib/notebook-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  // Reset is browser initiated: require an Origin, not just the absence of a mismatch.
  if (!request.headers.get("origin") || !sameOrigin(request)) {
    return Response.json({ error: "この画面から操作してください。" }, { status: 403, headers });
  }
  try {
    await notebookSession(true);
    // Only the HttpOnly session cookie changes. Stored notebooks are not deleted.
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "セッションを切り替えられませんでした。もう一度お試しください。" }, { status: 503, headers });
  }
}
