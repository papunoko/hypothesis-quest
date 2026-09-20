import { readFileSync } from "node:fs";
// 直観の声が答えを漏らしていないかを Jev で検閲できるかの実測。
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const apiKey = env.match(/^JEV_API_KEY=(.+)$/m)[1].trim();
const comments = [
  "型が違えば別物として扱われます。",
  "型まで厳格に判定する方向ですね。",
  "引数の一致を重視する方向ですね。",
  "実際は引数が1個のときだけ 1 と 1.0 が区別されます。",
  "例外を1つ置く構えですね。",
  "その説明だと2個の引数のケースで外れますよ。",
];
const questions = {
  leak: { type: "noul",
    instructions: "Does `comment` reveal or assert how the software actually behaves, or whether the player's draft is right or wrong?",
    criteria: { true: "The comment states a fact about the mechanism's real behavior (〜として扱われます, 実際は〜, 〜が区別されます) or judges the draft (外れます, 正しい, 違う).", false: "The comment only names the stance or direction the player's draft is taking (〜の方向ですね, 〜の立場ですね, 〜の構えですね) without claiming what the software does." } },
};
for (const comment of comments) {
  const t0 = Date.now();
  const res = await fetch("https://api.typesafe.ai/v1/systemone", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ state: { comment }, model: "jev-latest", questions }) });
  const j = await res.json();
  console.log(`${(j.answers?.leak?.noul ?? NaN).toFixed(2)}  ${String(Date.now()-t0).padStart(4)}ms  ${comment}`);
}
