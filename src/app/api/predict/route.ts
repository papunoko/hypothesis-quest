import { NextResponse } from "next/server";
import { CASES } from "@/subject/cases";
import { readHypothesis } from "@/lib/jev";
import { judge, pickNext } from "@/lib/select";
import { LRU_CASES } from "@/subject/lru";
import { readLruInput, type InputKind } from "@/lib/lru-input";
import { answerQuestion } from "@/subject/lru-questions";
import { notebook } from "@/lib/notebook";
import { notebookSession, sameOrigin } from "@/lib/notebook-session";
import type { NotebookEntry } from "@/lib/notebook-types";
import { randomUUID } from "node:crypto";
import { judgeLru, nextLru } from "@/lib/lru-select";
import { narrate, questionContext } from "@/lib/narration";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "別のサイトからは送信できません。" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const hypothesis = typeof body?.hypothesis === "string" ? body.hypothesis.trim() : "";
  const shown = new Set<string>(Array.isArray(body?.shown) ? body.shown : []);
  if (!hypothesis) return NextResponse.json({ error: "hypothesis is required" }, { status: 400 });

  try {
    if (body?.subject !== "orders") {
      if (hypothesis.length > 1000) return NextResponse.json({ error: "仮説は1000文字以内で入力してください。" }, { status: 400 });
      const session = await notebookSession();
      const store = notebook();
      const interpretation = await readLruInput(hypothesis, req.signal);
      const { reading } = interpretation;
      const forcedKind: InputKind | undefined = body.kind === "question" || body.kind === "assertion" ? body.kind : undefined;
      if (interpretation.needsKind && !forcedKind) return NextResponse.json({ ...interpretation, clarify: true });
      const kind = forcedKind || interpretation.kind;
      const entry: NotebookEntry = { id: randomUUID(), at: new Date().toISOString(), hypothesis, kind, interpretation, answer: "", cases: [] };
      if (kind !== "assertion") {
        const question = kind === "question" ? answerQuestion(interpretation.needsTopic ? "unsupported" : interpretation.topic) : undefined;
        entry.question = question;
        entry.answer = question?.answer ?? "質問か、現状の説明を一文で書いてみてください。";
        entry.cases = question?.cases ?? [];
        if (question) entry.narration = await narrate(questionContext(hypothesis, question), req.signal);
        await store.append(session, entry);
        return NextResponse.json({ ...interpretation, kind, question, narration: entry.narration, entryId: entry.id, message: entry.answer, results: [], next: null, entries: await store.list(session) });
      }
      const results = LRU_CASES.map((c) => judgeLru(c, reading));
      const next = nextLru(results, shown);
      entry.results = results;
      entry.cases = next ? [next.id] : [];
      entry.answer = next ? next.verdict === "mismatch" ? "予想と食い違い" : next.verdict === "match" ? "この例では一致" : "読み取りを確認" : "用意した事例を確認して終了";
      await store.append(session, entry);
      return NextResponse.json({ ...interpretation, kind, results, next: next?.id ?? null, reason: next?.verdict ?? "exhausted", entries: await store.list(session) });
    }
    // Jev は仮説文だけを読む（1リクエスト）。事例への当てはめと照合はコード。
    const reading = await readHypothesis(hypothesis);
    const results = CASES.map((c) => judge(c, reading));
    const { next, reason } = pickNext(results, shown);
    return NextResponse.json({ reading, results, next: next?.id ?? null, reason });
  } catch (e) {
    console.error("Prediction failed", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "読み取り、または帳面の保存に失敗しました。事例は予想なしでも確認できます。" }, { status: 502 });
  }
}
