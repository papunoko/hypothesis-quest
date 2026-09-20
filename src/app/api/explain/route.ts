import { notebook } from "@/lib/notebook";
import { notebookSession, sameOrigin } from "@/lib/notebook-session";
import { narrate, questionContext } from "@/lib/narration";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "別サイトからは送信できません。" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.entryId !== "string" || body.entryId.length > 100) return Response.json({ error: "質問を選んでください。" }, { status: 400 });
  try {
    const session = await notebookSession(); const store = notebook();
    const entry = (await store.list(session)).find((e) => e.id === body.entryId);
    if (!entry?.question) return Response.json({ error: "この帳面に質問が見つかりません。" }, { status: 404 });
    const hint = entry.hint ?? await narrate(questionContext(entry.hypothesis, entry.question, true), request.signal);
    await store.saveHint(session, entry.id, hint);
    return Response.json({ narration: hint, entries: await store.list(session) });
  } catch { return Response.json({ error: "解説を保存できませんでした。" }, { status: 503 }); }
}
