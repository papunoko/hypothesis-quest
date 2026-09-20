import type { D1Database, Fetcher } from "@cloudflare/workers-types";

// Import binding types only: Workers' global Request/Response types conflict
// with the browser/Next.js DOM types. Keep in sync with wrangler.jsonc.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
    WORKER_SELF_REFERENCE: Fetcher;
    OLLAMA_MODEL: string;
    PUBLIC_UNTIL: string;
    READ_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
    AI_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
    JEV_API_KEY?: string;
    OLLAMA_API_KEY?: string;
  }
}
