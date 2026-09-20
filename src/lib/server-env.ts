import { getCloudflareContext } from "@opennextjs/cloudflare";

export function serverEnv(key: "JEV_API_KEY" | "OLLAMA_API_KEY" | "OLLAMA_MODEL") {
  try {
    return getCloudflareContext().env[key];
  } catch {
    // Standalone evaluation scripts/tests run without a Workers context.
    return process.env[key];
  }
}
