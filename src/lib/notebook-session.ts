import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export async function notebookSession() {
  const jar = await cookies();
  const previous = jar.get("quest-session-3002")?.value;
  if (previous && /^[0-9a-f-]{36}$/i.test(previous)) return previous;
  const id = randomUUID();
  // Browser-session cookie: refreshes keep the same notebook. No identity in the URL.
  jar.set("quest-session-3002", id, { httpOnly: true, sameSite: "strict", path: "/" });
  return id;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return !origin || new URL(origin).host === (request.headers.get("host") || new URL(request.url).host); }
  catch { return false; }
}
