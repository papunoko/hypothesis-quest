import { notebook } from "@/lib/notebook";
import { notebookSession } from "@/lib/notebook-session";
export const runtime = "nodejs";
export async function GET() {
  try { return Response.json({ entries: await notebook().list(await notebookSession()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "帳面を開けませんでした。サーバーの保存先を確認してください。" }, { status: 503 }); }
}
