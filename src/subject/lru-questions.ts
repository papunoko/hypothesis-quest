import { LRU_CASES } from "./lru.ts";

// Each listed card changes only the named property between its two calls.
// 'contrasts' compare two verified experiments (not two individual calls).
export const QUESTION_TOPICS = {
  form: { label: "引数の書き方", question: "値が同じでも、省略・位置・名前の書き方を変えると記憶の使い方は変わる？", cases: ["L2", "L3"], contrasts: [], core: false },
  order: { label: "キーワードの順番", question: "キーワード引数の順番だけを変えると記憶の使い方は変わる？", cases: ["L4"], contrasts: [], core: false },
  types: { label: "引数の型", question: "typed=Falseで、等しい値の型を変えると毎回別扱いになる？", cases: ["L5", "L6"], contrasts: [], core: true },
  arity: { label: "引数の個数", question: "型を変えたときの結果は、引数が1個か2個かで変わる？", cases: ["L5", "L6"], contrasts: [["L5", "L6"]], core: true },
  typed: { label: "typedの設定", question: "同じ呼び出しの組でも、typedの設定を変えると結果は変わる？", cases: ["L6", "L7"], contrasts: [["L6", "L7"]], core: false },
} satisfies Record<string, { label: string; question: string; cases: string[]; contrasts: string[][]; core: boolean }>;
export type QuestionTopic = keyof typeof QUESTION_TOPICS;
export type QuestionAnswer = { topic?: QuestionTopic; question: string; answer: "はい" | "いいえ" | "場合による" | "関係ない" | "まだ答えられません"; cases: string[]; note: string; core: boolean };

export function answerQuestion(topic: QuestionTopic | "unrelated" | "unsupported"): QuestionAnswer {
  if (topic === "unrelated" || topic === "unsupported") return {
    question: "今回の呼び出しの同一性についての質問", answer: topic === "unrelated" ? "関係ない" : "まだ答えられません", cases: [], core: false,
    note: topic === "unrelated" ? "今回の題材とは関係しない話として読みました。読み違いなら、質問を書き直してください。" : "この質問に答える比較テストは用意していません。関係がない、と判定したわけではありません。",
  };
  const spec = QUESTION_TOPICS[topic];
  const outcome = (id: string) => LRU_CASES.find((c) => c.id === id)!.actual;
  const changes = spec.contrasts.length ? spec.contrasts.map(([a, b]) => outcome(a) !== outcome(b)) : spec.cases.map((id) => outcome(id) === "computed");
  const answer = changes.some(Boolean) && changes.some((v) => !v) ? "場合による" : changes.every(Boolean) ? "はい" : "いいえ";
  return { topic, question: spec.question, answer, cases: [...spec.cases], core: spec.core,
    note: answer === "場合による" ? "結果が分かれました。2枚を比べて、違いを1つ探してみてください。" : "これは表示した比較テストでの答えです。あらゆる呼び出しについての保証ではありません。" };
}
