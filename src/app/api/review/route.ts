import { randomUUID } from "node:crypto";
import { notebook } from "@/lib/notebook";
import { notebookSession, sameOrigin } from "@/lib/notebook-session";
import { readLruInput } from "@/lib/lru-input";
import { narrate } from "@/lib/narration";
import { DECISIONS, reviewCheck, reviewContext, type ReviewDecision, type Submission } from "@/lib/review";
export const runtime = "nodejs";
export async function GET() {
  try { return Response.json({ submissions: notebook().submissions(await notebookSession()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "提出履歴を読み込めませんでした。" }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "別サイトからは送信できません。" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const hypothesis = typeof body?.hypothesis === "string" ? body.hypothesis.trim() : "";
  const review = typeof body?.review === "string" ? body.review.trim() : "";
  if (!hypothesis || hypothesis.length > 1000 || !review || review.length > 3000 || !Object.hasOwn(DECISIONS, body?.decision ?? "")) return Response.json({ error: "仮説は1〜1000文字、レビューは1〜3000文字で、判断も選んでください。" }, { status: 400 });
  const id = typeof body.requestId === "string" && /^[0-9a-f-]{36}$/i.test(body.requestId) ? body.requestId : randomUUID();
  try {
    const store = notebook(); const session = await notebookSession(); const entries = store.list(session);
    const previous = store.submissions(session).find((s) => s.id === id);
    if (previous) {
      if (previous.hypothesis !== hypothesis || previous.review !== review || previous.decision !== body.decision) return Response.json({ error: "別の内容で同じ提出IDは使えません。再提出してください。" }, { status: 409 });
      return Response.json({ submission: previous });
    }
    // Submit is explicit; failure to interpret must never become a pass.
    const interpretation = await readLruInput(hypothesis, request.signal).catch(() => null);
    const reading = interpretation?.kind === "assertion" && !interpretation.needsKind ? interpretation.reading : null;
    const draft = { id, at: new Date().toISOString(), hypothesis, review, decision: body.decision as ReviewDecision, reading, ...reviewCheck(reading, entries) };
    const narration = await narrate(reviewContext(draft, entries), request.signal);
    const submission: Submission = store.submit(session, { ...draft, narration });
    return Response.json({ submission });
  } catch { return Response.json({ error: "提出を保存できませんでした。入力は残っています。もう一度試してください。" }, { status: 503 }); }
}
