import { readSupport, sanitizeSignals, shouldOffer } from "@/lib/support";
import { sameOrigin } from "@/lib/notebook-session";
export const runtime = "nodejs";

/** 行動シグナル（数だけ）から支援の種別を返す。入力文は受け取らない。 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "別サイトからは送信できません。" }, { status: 403 });
  const body = await request.json().catch(() => null);
  let signals;
  try { signals = sanitizeSignals(body?.signals); }
  catch { return Response.json({ error: "signals が不正です。" }, { status: 400 }); }
  try {
    const reading = await readSupport(signals, request.signal);
    return Response.json({ ...reading, offer: shouldOffer(reading, signals) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "支援の読み取りに接続できませんでした。" }, { status: 502 });
  }
}
