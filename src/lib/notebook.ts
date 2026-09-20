import { getCloudflareContext } from "@opennextjs/cloudflare";
import { openNotebook } from "./notebook-d1.ts";

export function notebook() {
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error("D1 binding DB is missing");
  // Request-scoped session, not a shared module singleton.
  return openNotebook(env.DB.withSession("first-primary"));
}
