import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
if (config.includes('"00000000-0000-0000-0000-000000000000"')) {
  console.error("先にD1を作成し、wrangler.jsoncのdatabase_idを設定してください。docs/deployment.md参照。");
  process.exit(1);
}
