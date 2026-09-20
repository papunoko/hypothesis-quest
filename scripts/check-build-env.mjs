import { readdirSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// OpenNext serializes all .env* modes into the Worker, including .env.local.
// Only public configuration belongs there; secrets must use .dev.vars/Secrets.
for (const file of readdirSync(process.cwd()).filter((name) => /^\.env(?:\.|$)/.test(name))) {
  const values = parseEnv(readFileSync(file, "utf8"));
  if (Object.entries(values).some(([name, value]) => value && !name.startsWith("NEXT_PUBLIC_"))) {
    console.error(`${file}: private environment values must be moved to .dev.vars / Workers Secrets before building.`);
    process.exit(1);
  }
}
