import { readFileSync } from "node:fs";
// 直観の声(LLM)の候補モデルを実測する。OLLAMA_API_KEY は .env.local から読む(表示しない)。
const key = readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^OLLAMA_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error("OLLAMA_API_KEY is not set in .env.local");
const models = ["gpt-oss:20b","glm-5.3-flash","gemma4:31b","deepseek-v4.1-flash","kimi-k2.7-code"];
const partials = [
  "同じ引数で呼べば",
  "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら",
  "値が等しくても型が違えば別",
];
const sys = `あなたはコードレビューに同席する相棒です。プレイヤーは「この仕組みが何を同じ呼び出しとみなすか」を一文で書いている途中です。
書きかけの文を読み、「いまどんな立場の説明に向かっているか」だけを言い当ててください。正しいか間違っているかは絶対に言わない。仕組みの実際の振る舞いも言わない。
出力は日本語で25字以内の一言のみ。例:「値だけで見る派ですね」「例外を1つ置く構えですね」`;
for (const model of models) for (const p of partials) {
  const t0 = Date.now(); let first = 0, out = "";
  const res = await fetch("https://ollama.com/api/chat", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true, think: false, options: { num_predict: 80, temperature: 0.4 }, messages: [{ role: "system", content: sys }, { role: "user", content: `書きかけ: ${p}` }] }) });
  if (!res.ok) { console.log(model, res.status, (await res.text()).slice(0,120)); continue; }
  const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  while (true) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
      try { const j = JSON.parse(line); const c = j.message?.content ?? ""; if (c && !first) first = Date.now() - t0; out += c; } catch {} } }
  console.log(`${model.padEnd(20)} ttft ${String(first).padStart(5)} total ${String(Date.now()-t0).padStart(5)} | ${p.slice(0,14).padEnd(15)} | ${out.replace(/\s+/g," ").slice(0,60)}`);
}
