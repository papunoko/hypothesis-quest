import { writeFileSync } from "node:fs";
import { readLruInput } from "../src/lib/lru-input.ts";
import { LRU_CASES } from "../src/subject/lru.ts";
import { judgeLru, nextLru } from "../src/lib/lru-select.ts";
import { answerQuestion } from "../src/subject/lru-questions.ts";

// Bounded real-model regression: topic relevance must not mean agreement.
const samples = [
  ["同じ引数で呼べば記憶を返す", "assertion", false],
  ["書き方は関係ある？", "question", false],
  ["型は関係ある？", "question", true],
  ["順番は関係ないの？", "question", false],
  ["引数の型が違っても、値が同じなら記憶を使えますか？", "question", true],
  ["型が違えば別の呼び出しになる", "assertion", true],
  ["型は関係なく、値が同じなら記憶を返す", "assertion", true],
  ["引数の個数で変わる？", "question", true],
] as const;
const rows = [];
for (const [text, kind, core] of samples) {
  for (let run = 1; run <= 2; run++) {
    const reading = await readLruInput(text);
    const results = LRU_CASES.map((card) => judgeLru(card, reading.reading));
    const next = nextLru(results, new Set(["L1"]));
    const question = reading.kind === "question" ? answerQuestion(reading.needsTopic ? "unsupported" : reading.topic) : null;
    const ok = reading.kind === kind && !reading.needsKind && (core ? reading.coreRelevance! >= 0.7 : reading.coreRelevance! <= 0.3)
      && (question ? question.cases.length > 0 : text !== samples[0][0] || next?.verdict === "mismatch");
    rows.push({ text, run, ok, reading, question, next });
    console.log(JSON.stringify({ text, run, ok, core: reading.coreRelevance, kind: reading.kind, next: question?.answer ?? next?.verdict }));
  }
}
const file = `docs/eval/support-ux-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
console.log(`${rows.filter((r) => r.ok).length}/${rows.length} ${file}`);
if (rows.some((r) => !r.ok)) process.exitCode = 1;
