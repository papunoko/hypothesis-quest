// 題材候補の収集: GitHub の「閉じられたが直さなかった」イシューを jsonl に落とす。
// 使い方: npm run subject:mine -- --repo python/cpython [--query '...'] [--limit 60] [--out path.jsonl]
//   既定の検索: is:issue is:closed reason:"not planned" comments:>=2（"not a bug" 系はここに集まる）
//   GITHUB_TOKEN があれば使う（無ければ検索10回/分・本体60回/時）。
// 出力: 1行1候補 { number, title, url, created_at, closed_at, state_reason, labels, body, comments[] }
// Jev はここでは呼ばない（順位付けは rank.mts）。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const repo = arg("--repo");
if (!repo) { console.error("--repo owner/name が必要"); process.exit(2); }
const query = arg("--query", 'is:issue is:closed reason:"not planned" comments:>=2')!;
const limit = Number(arg("--limit", "60"));
const out = arg("--out", `docs/eval/subject-candidates/${repo.replace("/", "-")}.jsonl`)!;
const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "hypothesis-quest-subject-forge" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gh(url: string) {
  for (;;) {
    const res = await fetch(url, { headers });
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
      const wait = Math.max(5_000, Math.min(reset, 90_000));
      console.error(`rate limit: ${Math.round(wait / 1000)}s 待つ`); await sleep(wait); continue;
    }
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
    return res.json();
  }
}
const cut = (s: string | null | undefined, n: number) => (s ?? "").replace(/\r/g, "").slice(0, n);

const items: any[] = [];
for (let page = 1; items.length < limit; page++) {
  const q = encodeURIComponent(`repo:${repo} ${query}`);
  const data = await gh(`https://api.github.com/search/issues?q=${q}&sort=comments&order=desc&per_page=${Math.min(50, limit - items.length)}&page=${page}`);
  if (!data.items?.length) break;
  items.push(...data.items);
  if (!process.env.GITHUB_TOKEN) await sleep(6_500); // 検索 10回/分
}
console.error(`${items.length} 件（${repo} / ${query}）`);

const lines: string[] = [];
for (const [i, it] of items.entries()) {
  const comments = it.comments > 0 ? await gh(`${it.comments_url}?per_page=8`) : [];
  lines.push(JSON.stringify({
    number: it.number, title: it.title, url: it.html_url, created_at: it.created_at, closed_at: it.closed_at, state_reason: it.state_reason,
    labels: (it.labels ?? []).map((l: any) => l.name), body: cut(it.body, 6000),
    comments: comments.map((c: any) => ({ author: c.user?.login, association: c.author_association, body: cut(c.body, 3000) })),
  }));
  console.error(`${i + 1}/${items.length} #${it.number} ${it.title}`);
  if (!process.env.GITHUB_TOKEN) await sleep(1_200); // 本体 60回/時 に収める
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n") + "\n");
console.log(`→ ${out}（${lines.length} 件）`);
