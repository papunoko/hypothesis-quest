// 実行: node --experimental-strip-types scripts/probe-axes-llm-vs-jev.mjs
import { readFileSync } from "node:fs";
import { LRU_AXES } from "../src/subject/lru.ts";
// Jev の仕事(6軸の読み取り)を LLM にさせた場合との比較。両キーは .env.local から読む(表示しない)。
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const okey = env.match(/^OLLAMA_API_KEY=(.+)$/m)?.[1]?.trim(); if (!okey) throw new Error("OLLAMA_API_KEY is not set");
const jkey = env.match(/^JEV_API_KEY=(.+)$/m)[1].trim();
const axes = Object.keys(LRU_AXES);
const inputs = process.env.DBG ? ["同じ引数で呼べば記憶を返す"] : [
  "同じ引数で呼べば記憶を返す",
  "引数の書き方（位置・キーワード・順番）まで同じなら計算しない",
  "値が等しくても型が違えば別の呼び出しとして計算する",
  "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵になる",
  "キーワード引数の順番が違っても同じ呼び出しとみなす",
  "同じ商品は重複して登録しない",
  "同じ引数で",
  "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら",
];
async function jev(h) {
  const t0 = Date.now();
  const r = await fetch("https://api.typesafe.ai/v1/systemone", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jkey}` },
    body: JSON.stringify({ state: { hypothesis: h }, model: "jev-latest", questions: Object.fromEntries(axes.map(a => [a, { type: "noul", instructions: LRU_AXES[a].instructions, criteria: LRU_AXES[a].criteria }])) }) });
  const j = await r.json(); return { ms: Date.now()-t0, v: axes.map(a => j.answers?.[a]?.noul) };
}
const spec = axes.map(a => `- ${a}: ${LRU_AXES[a].instructions}\n    yes if: ${LRU_AXES[a].criteria.true}\n    no if: ${LRU_AXES[a].criteria.false}`).join("\n");
async function llm(model, h) {
  const t0 = Date.now();
  const r = await fetch("https://ollama.com/api/chat", { method: "POST", headers: { Authorization: `Bearer ${okey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, think: false, format: "json", options: { temperature: 0, num_predict: 200 },
      messages: [{ role: "system", content: `For each question, give the probability (0..1) that the answer is yes for the given hypothesis. Output only JSON {${axes.map(a=>`"${a}":number`).join(",")}}.\n\nQuestions:\n${spec}` }, { role: "user", content: `hypothesis: ${h}` }] }) });
  const j = await r.json(); let v = axes.map(() => NaN);
  const raw = ((j.message?.content ?? "").match(/{[^{}]*}/g) ?? []).pop() ?? ""; if (process.env.DBG) console.log(model, JSON.stringify(j).slice(0, 300)); try { const o = JSON.parse(raw); v = axes.map(a => Number(o[a])); } catch {}
  return { ms: Date.now()-t0, v };
}
const fmt = (x) => axes.map((_, i) => (Number.isFinite(x.v[i]) ? x.v[i].toFixed(2) : " n/a").padStart(6)).join("") + String(x.ms).padStart(6) + "ms";
console.log(" ".repeat(10) + axes.map(a => a.slice(0,5).padStart(6)).join(""));
for (const h of inputs) {
  console.log("\n" + h.slice(0, 40));
  const [a, b, c] = await Promise.all([jev(h), llm("gemma4:31b", h), llm("glm-5.3-flash", h)]);
  console.log("  jev     " + fmt(a)); console.log("  gemma4  " + fmt(b)); console.log("  glm-fl  " + fmt(c));
}
