import { NextResponse } from "next/server";
import { CASES } from "@/subject/cases";
import { readHypothesis } from "@/lib/jev";
import { judge, pickNext } from "@/lib/select";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const hypothesis = typeof body?.hypothesis === "string" ? body.hypothesis.trim() : "";
  const shown = new Set<string>(Array.isArray(body?.shown) ? body.shown : []);
  if (!hypothesis) return NextResponse.json({ error: "hypothesis is required" }, { status: 400 });

  try {
    // Jev は仮説文だけを読む（1リクエスト）。事例への当てはめと照合はコード。
    const reading = await readHypothesis(hypothesis);
    const results = CASES.map((c) => judge(c, reading));
    const { next, reason } = pickNext(results, shown);
    return NextResponse.json({ reading, results, next: next?.id ?? null, reason });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
