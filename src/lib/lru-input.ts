import { LRU_AXES, type LruAxis, type LruReading } from "../subject/lru.ts";
import { evaluateInput, parseNoul } from "./noul.ts";
import type { QuestionTopic } from "../subject/lru-questions.ts";

const choices = {
  kind: { type: "choice", instructions: "What is the communicative purpose of `hypothesis`? Classify the input, not whether it is correct.", criteria: {
    question: "Asks about behavior, e.g. 型は関係ある？ 順番は関係ないの？ What happens?",
    assertion: "Proposes a rule or explanation, e.g. 同じ引数で呼べば記憶を返す. A hypothesis, not a request for an answer.",
    other: "Neither a question nor a proposed explanation, e.g. greetings or I don't know.",
  } },
  topic: { type: "choice", instructions: "If `hypothesis` is a question, which ONE general comparison does it ask about? Read the question topic, NOT its answer. A negated question has the same topic. Choose unsupported for specific unlisted examples or multiple independent topics.", criteria: {
    form: "Whether writing equal arguments differently (omitted default, positional versus keyword) affects cache reuse.",
    order: "Whether keyword argument order matters, including 順番は関係ないの？",
    types: "Whether equal values with different types are distinguished, in general or typed=False. 型は関係ある？ 型が違えば常に別？",
    arity: "Whether argument count matters, e.g. 引数の個数で変わる？ or 1個か2個かが関係ある？",
    typed: "What changes when the typed option is True versus False, or does typed=True distinguish types?",
    unrelated: "Wholly unrelated to function caching, e.g. 商品の値段 or 天気.",
    unsupported: "A particular call not covered by a general comparison (f(True), lists, subclasses), values changing, eviction, why/performance/internal algorithm, unclear topic, or multiple independent questions. Do not convert these to a general type question.",
  } },
} as const;
export type InputKind = "question" | "assertion" | "other";
type Topic = QuestionTopic | "unrelated" | "unsupported";
export type InputReading = { reading: LruReading; kind: InputKind; topic: Topic; needsKind: boolean; needsTopic: boolean; kindProbabilities: Record<InputKind, number>; coreRelevance?: number };

// Display only: mentioning the puzzle's topic is different from asserting its rule.
export const CORE_RELEVANCE = { type: "noul", instructions: "In this lru_cache exercise, does `hypothesis` discuss the topic of argument types or argument count?", criteria: {
  true: "It mentions types (型, int, float, typed) or argument count (個数, 1個, 2個). Short questions such as 型は関係ある？ and 引数の個数で変わる？ count; they need not repeat the cache context. Asking, asserting, and denying all count, regardless of correctness.",
  false: "The input only discusses argument values, omitted defaults, positional versus keyword spelling, keyword order, eviction, or an unrelated topic, without discussing types or argument count.",
} } as const;

export function parseChoice<K extends string>(value: unknown, options: readonly K[]): { choice: K; probabilities: Record<K, number> } {
  if (!value || typeof value !== "object") throw new Error("Invalid Choice");
  const v = value as { type?: string; choice?: K; confidence?: number; probabilities?: Record<K, number> };
  if (v.type !== "choice" || !options.includes(v.choice!) || !v.probabilities || !Number.isFinite(v.confidence) || v.confidence! < 0 || v.confidence! > 1) throw new Error("Invalid Choice");
  const probabilities = v.probabilities;
  if (options.some((k) => !Number.isFinite(probabilities[k]) || probabilities[k] < 0 || probabilities[k] > 1) || Math.abs(options.reduce((sum, k) => sum + probabilities[k], 0) - 1) > 0.02 || options.some((k) => probabilities[k] > probabilities[v.choice!] + 0.001)) throw new Error("Invalid Choice probabilities");
  return { choice: v.choice!, probabilities };
}

export async function readLruInput(hypothesis: string, signal?: AbortSignal): Promise<InputReading> {
  const data = await evaluateInput(hypothesis, {
    ...Object.fromEntries(Object.entries(LRU_AXES).map(([key, q]) => [key, { type: "noul", instructions: q.instructions, criteria: q.criteria }])), ...choices,
    coreRelevance: CORE_RELEVANCE,
  }, signal);
  const kind = parseChoice(data.answers?.kind, Object.keys(choices.kind.criteria) as InputKind[]);
  const topic = parseChoice(data.answers?.topic, Object.keys(choices.topic.criteria) as Topic[]);
  let coreRelevance: number | undefined;
  try { coreRelevance = parseNoul(data, ["coreRelevance"]).coreRelevance; }
  catch { /* A missing display-only value must not block the actual comparison. */ }
  return { reading: parseNoul(data, Object.keys(LRU_AXES) as LruAxis[]), kind: kind.choice, topic: topic.choice,
    needsKind: kind.probabilities[kind.choice] < 0.65,
    needsTopic: topic.probabilities[topic.choice] < 0.65,
    kindProbabilities: kind.probabilities, coreRelevance };
}
