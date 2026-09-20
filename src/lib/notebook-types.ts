import type { InputReading, InputKind } from "./lru-input.ts";
import type { QuestionAnswer } from "../subject/lru-questions.ts";
import type { LruResult } from "./lru-select.ts";
import type { Narration } from "./narration.ts";

export type NotebookEntry = {
  id: string; at: string; hypothesis: string; kind: InputKind; interpretation: InputReading;
  answer: string; cases: string[]; question?: QuestionAnswer; results?: LruResult[];
  narration?: Narration; hint?: Narration;
};
