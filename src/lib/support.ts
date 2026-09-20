/**
 * 行動シグナルから「いまどの支援が要るか」を Jev に読ませる。
 *
 * 渡すのは数だけ（経過秒・文字数・スクロール・ポインタ移動・進み具合）。入力文は渡さない。
 * 文の読み取りは鏡（/api/read）が別にやる。ここが読むのは「止まり方」。
 * 判定は Jev、出す文言と候補はコード側の固定文（LLM は使わない）。
 */
import { evaluateState, parseNoul } from "./noul.ts";
import { parseChoice } from "./lru-input.ts";

export const SUPPORT_KINDS = ["none", "start", "stuck", "explore", "send"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export type SupportSignals = {
  /** いまの事例（または返答）が表示されてからの秒数 */
  secondsOnCase: number;
  /** 最後に文字を確定してからの秒数。まだ何も打っていなければ secondsOnCase と同じ */
  secondsSinceInput: number;
  /** 入力欄の確定済み文字数（IME 変換中の文字は数えない） */
  inputChars: number;
  /** この事例でのスクロール回数 */
  scrollCount: number;
  /** 0〜1。ページのどこまで下がったか */
  scrollDepth: number;
  /** この事例でのポインタ移動の回数（250ms に1回まで数える） */
  pointerMoves: number;
  /** 見た事例数（7まで） */
  casesSeen: number;
  /** これまでに送った質問・仮説の数 */
  submissions: number;
  /** 鏡がいまの一文を読み終えているか */
  readingReady: boolean;
  /** 入力欄にフォーカスがあるか */
  focused: boolean;
};

const LIMITS: Record<keyof SupportSignals, [number, number] | "boolean"> = {
  secondsOnCase: [0, 3600], secondsSinceInput: [0, 3600], inputChars: [0, 1000], scrollCount: [0, 10_000], scrollDepth: [0, 1],
  pointerMoves: [0, 100_000], casesSeen: [0, 7], submissions: [0, 1000], readingReady: "boolean", focused: "boolean",
};

/** 型と範囲を確かめ、範囲外は端に丸める。数でないものは受け付けない。 */
export function sanitizeSignals(value: unknown): SupportSignals {
  if (!value || typeof value !== "object") throw new Error("signals must be an object");
  const raw = value as Record<string, unknown>;
  const out = {} as Record<string, number | boolean>;
  for (const [key, limit] of Object.entries(LIMITS)) {
    const v = raw[key];
    if (limit === "boolean") { if (typeof v !== "boolean") throw new Error(`signals.${key} must be boolean`); out[key] = v; continue; }
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`signals.${key} must be a finite number`);
    out[key] = Math.min(limit[1], Math.max(limit[0], Math.round(v * 100) / 100));
  }
  return out as SupportSignals;
}

/** Jev に渡す言い直し。数値を英語の事実文にする（決定的、LLM なし）。 */
export function summarizeSignals(s: SupportSignals): string {
  const typed = s.inputChars === 0 ? "Nothing has been typed in the box." : `${s.inputChars} characters are in the box; the last character was confirmed ${s.secondsSinceInput}s ago.`;
  const reading = s.inputChars === 0 ? "" : s.readingReady ? " The reading of the current sentence is ready." : " The current sentence has not been read yet.";
  return `${s.secondsOnCase}s since the current card appeared. ${typed}${reading} The box is ${s.focused ? "focused" : "not focused"}. Scrolled ${s.scrollCount} times, now at ${Math.round(s.scrollDepth * 100)}% of the page. Pointer moved ${s.pointerMoves} times. ${s.casesSeen} of 7 cases seen, ${s.submissions} inputs sent so far.`;
}

export const SUPPORT_QUESTIONS = {
  paused: { type: "noul", instructions: "Does `summary` describe a person who has stopped making progress at the text box, rather than one who is still reading or writing?", criteria: {
    true: "A long time has passed on the card (roughly 20s or more) with no new confirmed characters for a while. Idle with nothing typed, a sentence left unsent, or a minute or more of scrolling around with nothing typed all count: the box is not progressing.",
    false: "Characters were confirmed within the last few seconds, the card appeared only moments ago, or the person is still scrolling through a card that appeared under a minute ago: they are reading or writing and should be left alone.",
  } },
  kind: { type: "choice", instructions: "If `summary` shows a pause, which ONE kind of help fits it? Choose none while the person is still reading or writing.", criteria: {
    none: "Still active: recent confirmed characters, a card that just appeared, or steady scrolling. No help now.",
    start: "Nothing typed and little scrolling after a while on the card: they do not know what to write first.",
    stuck: "Some text typed, then a long pause without sending, especially when the text is short or the reading is not ready: hesitating mid-sentence.",
    explore: "Nothing or little typed, but many scrolls or a deep scroll with pointer movement: they are looking for something on the page rather than writing.",
    send: "A sentence is typed and its reading is ready, then a pause: they only need a nudge to send it.",
  } },
} as const;

export type SupportReading = { kind: SupportKind; confidence: number; paused: number };

export async function readSupport(signals: SupportSignals, signal?: AbortSignal): Promise<SupportReading> {
  const data = await evaluateState({ signals, summary: summarizeSignals(signals) }, SUPPORT_QUESTIONS, signal);
  const paused = parseNoul(data, ["paused"]).paused;
  const kind = parseChoice(data.answers?.kind, SUPPORT_KINDS);
  return { kind: kind.choice, confidence: kind.probabilities[kind.choice], paused };
}

/**
 * 出すかどうかは閾値でコードが決める。迷いは「出さない」に倒す。
 * explore だけは事例表示から60秒待つ: 読み進めている最中のスクロールも Jev は paused 0.7 台で読む
 * （docs/eval/support-probe-2026-09-20.md）。「1分」は基準文に書いた数字をそのままコードで守る。
 */
export function shouldOffer(reading: SupportReading, signals: SupportSignals): reading is SupportReading & { kind: Exclude<SupportKind, "none"> } {
  if (reading.kind === "none" || reading.paused < 0.6 || reading.confidence < 0.5) return false;
  return reading.kind !== "explore" || signals.secondsOnCase >= 60;
}
