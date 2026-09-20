// lru_cache 題材の軸候補を Jev(Noul) で実測する。キーは .env.local から読む(表示しない)。
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const apiKey = env.match(/^JEV_API_KEY=(.+)$/m)?.[1]?.trim();
if (!apiKey) throw new Error("no key");

const AXES = {
  values: {
    instructions: "Does `hypothesis` say that two calls count as the same call when their argument values are equal?",
    criteria: {
      true: "The rule for reusing a remembered result is based on the argument values being equal or the same (同じ引数, 同じ値, 等しい値).",
      false: "Values are not named as the basis, or the text only talks about how arguments are written, their order, or their types.",
    },
  },
  form: {
    instructions: "Does `hypothesis` say that how the arguments are written (positional vs keyword, or a default value omitted vs spelled out) affects whether two calls are the same?",
    criteria: {
      true: "The text mentions 書き方, 位置引数/キーワード引数, デフォルト値の省略, or an equivalent notion of call syntax as part of sameness.",
      false: "Only values, order, or types are named. No mention of how the call is written.",
    },
  },
  order: {
    instructions: "Does `hypothesis` say that the order of keyword arguments affects whether two calls are the same?",
    criteria: {
      true: "The text says keyword order matters (順番が違えば別, 順番まで同じなら).",
      false: "Order is not mentioned, or the text says order does not matter.",
    },
  },
  type: {
    instructions: "Does `hypothesis` say that the types of the arguments (for example int versus float) affect whether two calls are the same?",
    criteria: {
      true: "The text says type matters (型が違えば別, 1 と 1.0 は別).",
      false: "Types are not mentioned, or the text says equal values are the same regardless of type.",
    },
  },
  arity: {
    instructions: "Does `hypothesis` describe a special case that depends on the number of arguments (for example a single argument being treated differently)?",
    criteria: {
      true: "The text singles out calls with one argument, or says the rule changes with the number of arguments (引数が1個だけなら, 引数の個数で変わる).",
      false: "One rule is stated for all calls, with no exception by argument count.",
    },
  },
};

const HYPOTHESES = [
  "同じ引数で呼べば記憶を返す",
  "引数の書き方（位置・キーワード・順番）まで同じなら計算しない",
  "値が等しくても型が違えば別の呼び出しとして計算する",
  "引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵になる",
  "キーワード引数の順番が違っても同じ呼び出しとみなす",
  "同じ商品は重複して登録しない",
];

const questions = Object.fromEntries(Object.entries(AXES).map(([k, v]) => [k, { type: "noul", ...v }]));

async function read(hypothesis) {
  const t0 = Date.now();
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ state: { hypothesis }, model: "jev-latest", questions }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const ms = Date.now() - t0;
  return { ms, r: Object.fromEntries(Object.keys(AXES).map((k) => [k, json.answers?.[k]?.noul])) };
}

const keys = Object.keys(AXES);
console.log("hypothesis".padEnd(44) + keys.map((k) => k.padStart(7)).join("") + "     ms");
for (const h of HYPOTHESES) {
  const { ms, r } = await read(h);
  const row = keys.map((k) => (typeof r[k] === "number" ? r[k].toFixed(2) : "  n/a").padStart(7)).join("");
  console.log(h.slice(0, 42).padEnd(44) + row + String(ms).padStart(7));
}
