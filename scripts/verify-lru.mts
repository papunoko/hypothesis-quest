import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { LRU_CASES, LRU_EXTRA } from "../src/subject/lru.ts";

const path = fileURLToPath(new URL("./verify-lru.py", import.meta.url));
const windows = process.platform === "win32";
const pythonPath = windows ? `/mnt/${path[0].toLowerCase()}${path.slice(2).replaceAll("\\", "/")}` : path;
const run = spawnSync(windows ? "wsl.exe" : "python3", windows ? ["--exec", "python3", pythonPath] : [pythonPath], { encoding: "utf8", timeout: 30_000 });
if (run.error) throw run.error;
if (run.status !== 0) throw new Error(run.stderr || `Python exited ${run.status}`);
const observed = JSON.parse(run.stdout);
assert.equal(observed.python, "3.12.3", "Card observations are pinned to CPython 3.12.3");
for (const card of [...LRU_CASES, LRU_EXTRA]) {
  assert.equal(observed.results.find((r: { id: string }) => r.id === card.id)?.outcome, card.actual, card.id);
}
console.log(`CPython ${observed.python}: all 8 UI card outcomes match execution.`);
