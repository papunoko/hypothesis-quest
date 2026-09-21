import { readFileSync } from "node:fs";

// wrangler.jsonc は本番の account_id / database_id を含むため Git に入れない（.gitignore）。
// 雛形は wrangler.example.jsonc。手順は docs/deployment.md。
let config;
try {
  config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
} catch {
  console.error("wrangler.jsonc がありません。wrangler.example.jsonc を複製し、account_id と database_id を設定してください。docs/deployment.md参照。");
  process.exit(1);
}
if (config.includes('"00000000-0000-0000-0000-000000000000"') || config.includes("YOUR_D1_DATABASE_ID")) {
  console.error("先にD1を作成し、wrangler.jsoncのdatabase_idを設定してください。docs/deployment.md参照。");
  process.exit(1);
}
