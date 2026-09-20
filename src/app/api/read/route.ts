import { readLruInput } from "@/lib/lru-input";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const hypothesis = typeof body?.hypothesis === "string" ? body.hypothesis.trim() : "";
  if (!hypothesis || hypothesis.length > 1000) return Response.json({ error: "仮説を1〜1000文字で入力してください。" }, { status: 400 });
  try {
    return Response.json({ hypothesis, ...await readLruInput(hypothesis, request.signal) });
  } catch {
    return Response.json({ error: "読み取りに接続できませんでした。事例は予想なしでも確認できます。" }, { status: 502 });
  }
}
