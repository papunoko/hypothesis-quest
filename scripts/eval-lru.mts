import { LRU_AXES, LRU_CASES } from "../src/subject/lru.ts";
import { readNoul } from "../src/lib/noul.ts";
import { judgeLru, nextLru } from "../src/lib/lru-select.ts";

const examples = [
  ["同じ引数で呼べば記憶を返す", "L2"],
  ["引数の値が等しければ以前の計算結果を使う", "L2"],
  ["Equal argument values reuse the cached result.", "L2"],
  ["引数の書き方まで同じなら計算しない", "L4"],
  ["位置引数かキーワード引数か、省略するかどうかも同じなら記憶を返す", "L4"],
  ["引数の書き方（位置・キーワード・順番）まで同じなら計算しない", "L5"],
  ["値・引数の渡し方・キーワードの順番が同じなら記憶を使う", "L5"],
  ["引数の値と書き方と順番と型まで同じなら記憶を返す", "L6"],
  ["値が等しくても型が違えば別の呼び出しとして計算する", "L2"],
  ["キーワード引数の順番が違っても同じ呼び出しとみなす", "L2"],
  ["引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵になる", "L7"],
  ["引数の書き方と順番を区別する。1と1.0は引数が1個なら別、2個なら同じ。typed=Trueでは型も区別する", "L2"],
  ["同じ商品は重複して登録しない", "L2"],
  ["よくわからない", "L2"],
];
// L1 is shown as the initial baseline. Matching rules fall through to first unseen L2.
let passed = 0;
for (const [hypothesis, expected] of examples) {
  const start = performance.now();
  const reading = await readNoul(hypothesis, LRU_AXES);
  const results = LRU_CASES.map((c) => judgeLru(c, reading));
  const next = nextLru(results, new Set(["L1"]));
  const pass = next?.id === expected;
  passed += Number(pass);
  console.log(JSON.stringify({ hypothesis, reading, next: next?.id, verdict: next?.verdict, pass, ms: Math.round(performance.now() - start) }));
}
console.log(`${passed}/${examples.length} expected selections`);
if (passed !== examples.length) process.exitCode = 1;
