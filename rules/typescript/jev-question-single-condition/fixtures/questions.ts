// Noul / Choice questions sent to the judgment model. Only the hypothesis text is in the state.
type Noul = { type: "noul"; instructions: string; criteria: { true: string; false: string } };
type Choice = { type: "choice"; instructions: string; criteria: Record<string, string> };

export const DEDUP_AXES: Record<string, Noul> = {
  sameContent: {
    type: "noul",
    instructions: "Does `hypothesis` explicitly name matching products or contents as a condition for reusing a registration?",
    criteria: {
      true: "The reuse/deduplication rule explicitly says 同じ商品 or 同じ中身 (or equivalent).",
      false: "Only IDs or retries are named. Different contents mentioned in a rejection clause do not count.",
    },
  },
  sameKey: {
    type: "noul",
    instructions: "Does `hypothesis` explicitly name matching request IDs as a condition for reusing a registration?",
    criteria: {
      true: "The reuse/deduplication rule explicitly says 同じ依頼ID (or equivalent).",
      false: "Only products or retries are named. IDs mentioned only in a rejection clause do not count.",
    },
  },
  retry: {
    type: "noul",
    instructions: "Does `hypothesis` explicitly mention retries or resending?",
    criteria: {
      true: "The text explicitly says 再送, 再試行, もう一度送る (or equivalent).",
      false: "No retry or resending is mentioned. Matching IDs or products alone do not imply retries.",
    },
  },
  rejectConflict: {
    type: "noul",
    instructions: "Does `hypothesis` say to reject different contents sent with the same request ID?",
    criteria: {
      true: "Explicit rejection or error for different contents with the same ID.",
      false: "No rejection clause. Keeping one registration alone does not imply rejection.",
    },
  },
};

export const CACHE_AXES: Record<string, Noul> = {
  rule: {
    type: "noul",
    instructions: "Is `hypothesis` a proposed rule about function arguments, cached results, or cache keys?",
    criteria: {
      true: "Mentions 引数, 呼び出し, 計算結果, キャッシュ, or cache keys and proposes how they are compared or reused.",
      false: "Unrelated topic such as product registration, or says only I don't know. No rule about function calls.",
    },
  },
  order: {
    type: "noul",
    instructions: "Does `hypothesis` explicitly say that keyword argument order matters?",
    criteria: {
      true: "Explicitly says 順番まで同じ, 順番を区別する, 順番が違えば別, or 引数の並びをそのまま鍵にする.",
      false: "No order claim, including 同じ引数 or 同じ書き方 alone. Also false if it explicitly says order does not matter.",
    },
  },
  types: {
    type: "noul",
    instructions: "Does `hypothesis` explicitly name argument type as a matching requirement?",
    criteria: {
      true: "型まで同じなら, 型が違えば別, 1と1.0は別. Matching types is a condition for reusing results.",
      false: "Types are absent or ignored. A rule ONLY about typed=True or a single-argument special case is not a general matching requirement.",
    },
  },
  typedAndCorrect: {
    type: "noul",
    instructions: "Does `hypothesis` mention the typed=True setting, and is what it says about that setting consistent with the observed results?",
    criteria: {
      true: "The setting is named and the claim about it agrees with the recorded outcomes.",
      false: "The setting is not named, or the claim about it contradicts the recorded outcomes.",
    },
  },
  singleFast: {
    type: "noul",
    instructions: "Does `hypothesis` describe the special key rule for a single positional int or str argument?",
    criteria: {
      true: "A single int/str argument is its own key, unlike a sequence of multiple arguments. Or explicitly says 1 and 1.0 differ with one argument but are equal with two.",
      false: "Only says argument count matters without describing the rule, or a blanket type rule. No specific single-argument exception.",
    },
  },
};

export const INPUT_KIND: Choice = {
  type: "choice",
  instructions: "What is the communicative purpose of `hypothesis`? Classify the input, not whether it is correct.",
  criteria: {
    question: "Asks about behavior, e.g. 型は関係ある？ What happens?",
    assertion: "Proposes a rule or explanation, e.g. 同じ引数で呼べば記憶を返す.",
    other: "Neither a question nor a proposed explanation, e.g. greetings or I don't know.",
  },
};

export const QUESTION_TOPIC: Choice = {
  type: "choice",
  instructions: "If `hypothesis` is a question, which ONE general comparison does it ask about, and does the player already know the answer?",
  criteria: {
    form: "Whether writing equal arguments differently affects cache reuse, and the player has not seen a form case yet.",
    order: "Whether keyword argument order matters, and the player has not seen an order case yet.",
    known: "Any topic whose answer the player has already been shown.",
    unsupported: "A particular call not covered by a general comparison, or multiple independent questions.",
  },
};

export const LEAK_SCREEN: Noul = {
  type: "noul",
  instructions: "Does `draft` explain the hidden cause or name which feature differs between the comparison cards?",
  criteria: {
    true: "Explains why results differ, e.g. argument count, int fast path, internal keys. This is a spoiler even if inferred from the calls.",
    false: "Only states supplied outcomes or invites comparing the cards, without explaining the difference.",
  },
};
