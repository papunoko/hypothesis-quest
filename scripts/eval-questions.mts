import { readLruInput } from "../src/lib/lru-input.ts";
import { answerQuestion } from "../src/subject/lru-questions.ts";
const samples = [
  ["型は関係ある？", "question", "types"],
  ["キーワード引数の順番は関係ないの？", "question", "order"],
  ["省略せずに0を書くと変わる？", "question", "form"],
  ["引数の個数は関係ある？", "question", "arity"],
  ["typed=Trueに変えるとどうなる？", "question", "typed"],
  ["f(True)ならどうなる？", "question", "unsupported"],
  ["今日の天気は関係ある？", "question", "unrelated"],
  ["同じ引数で呼べば記憶を返す", "assertion", null],
  ["引数の書き方と順番まで同じなら記憶を返す", "assertion", null],
] as const;
let correct = 0;
for (const [text, kind, topic] of samples) {
  const start = Date.now(); const result = await readLruInput(text);
  const ok = result.kind === kind && !result.needsKind && (!topic || result.topic === topic && !result.needsTopic);
  if (ok) correct++;
  console.log(JSON.stringify({ text, ok, kind: result.kind, topic: result.topic, needsKind: result.needsKind, needsTopic: result.needsTopic, answer: result.kind === "question" ? answerQuestion(result.needsTopic ? "unsupported" : result.topic).answer : undefined, ms: Date.now() - start }));
}
console.log(`${correct}/${samples.length} expected routes`);
if (correct !== samples.length) process.exitCode = 1;
