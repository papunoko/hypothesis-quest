// @ts-ignore OpenNext generates this module during build.
import handler from "./.open-next/worker.js";
import { publicationGate, publicationEnded, closedResponse } from "./src/lib/publication.ts";
import type { ExecutionContext } from "@cloudflare/workers-types";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const blocked = await publicationGate(request, env);
    if (blocked) return blocked;
    const response = new URL(request.url).pathname.startsWith("/_next/static/")
      ? await env.ASSETS.fetch(request.url, { method: request.method, headers: [...request.headers] })
      : await handler.fetch(request, env, ctx);
    if (publicationEnded(env.PUBLIC_UNTIL)) return closedResponse(request);
    // Do not let an intermediary keep serving the app beyond its public period.
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
