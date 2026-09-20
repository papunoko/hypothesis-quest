// `.dev.vars` の JEV_API_KEY を載せて jev-lint を呼ぶ薄いラッパー。
// 使い方: node --env-file=.dev.vars scripts/harness/jev-lint.mts check --dry-run
//         npm run lint:jev -- review --base master
//
// Windows: jev-lint 0.3.2 は `@ast-grep/cli/ast-grep`（拡張子なしのシェルスクリプト）を
// execFile して失敗し「ast-grep rejected the rule set:」（詳細なし）で止まる。
// 実行ファイル本体（cli-win32-x64-msvc/ast-grep.exe）を JEV_LINT_AST_GREP で渡して回避する。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function findAstGrepExe(): string | undefined {
  const local = join("node_modules", "@ast-grep", "cli-win32-x64-msvc", "ast-grep.exe");
  if (existsSync(local)) return local;
  const cache = join(process.env.LOCALAPPDATA ?? "", "npm-cache", "_npx");
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache)) {
    const exe = join(cache, dir, "node_modules", "@ast-grep", "cli-win32-x64-msvc", "ast-grep.exe");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const env = { ...process.env };
if (process.platform === "win32" && !env.JEV_LINT_AST_GREP) {
  const exe = findAstGrepExe();
  if (exe) env.JEV_LINT_AST_GREP = exe;
  else console.error("jev-lint: ast-grep.exe が見つからない。`npx -y jev-lint --help` を一度実行するか JEV_LINT_AST_GREP を設定。");
}
const result = spawnSync("npx", ["-y", "jev-lint", ...process.argv.slice(2)], { stdio: "inherit", shell: true, env });
process.exit(result.status ?? 1);
