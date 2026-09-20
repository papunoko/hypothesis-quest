import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR/revalidation is used. User history is read from D1, never cached.
export default defineCloudflareConfig({});
