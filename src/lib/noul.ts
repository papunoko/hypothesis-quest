import { serverEnv } from "./server-env.ts";
export type NoulQuestion = { instructions: string; criteria: { true: string; false: string } };

/** Shared HTTP transport; only hypothesis text is sent, never observed outcomes. */
export async function readNoul<A extends string>(hypothesis: string, axes: Record<A, NoulQuestion>, signal?: AbortSignal): Promise<Record<A, number>> {
  const data = await evaluateInput(hypothesis, Object.fromEntries(Object.entries<NoulQuestion>(axes).map(([key, question]) => [key, { type: "noul", ...question }])), signal);
  return parseNoul(data, Object.keys(axes) as A[]);
}

export async function evaluateInput(hypothesis: string, questions: Record<string, unknown>, signal?: AbortSignal) {
  return evaluateState({ hypothesis }, questions, signal);
}

/** Grounded-output screening is separate from hypothesis interpretation. */
export async function evaluateState(state: unknown, questions: Record<string, unknown>, signal?: AbortSignal) {
  const apiKey = serverEnv("JEV_API_KEY");
  if (!apiKey) throw new Error("JEV_API_KEY is not set");
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ state, model: "jev-latest", questions }),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  });
  if (!response.ok) throw new Error(`Jev ${response.status}`);
  return response.json();
}

export function parseNoul<A extends string>(data: { answers?: Record<string, { type?: string; noul?: number }> }, keys: A[]): Record<A, number> {
  const reading = {} as Record<A, number>;
  for (const key of keys) {
    const answer = data.answers?.[key];
    if (answer?.type !== "noul" || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) throw new Error(`Invalid Jev answer: ${key}`);
    reading[key] = answer.noul;
  }
  return reading;
}
