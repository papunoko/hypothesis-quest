"use client";
import { useState } from "react";
import type { SupportKind } from "@/lib/support";

/**
 * 止まり方に合わせた固定の助け舟。種別は Jev（/api/support）か本人の「ヒント」ボタンで決まる。
 * 文言と候補はここに固定で書く。答え（1個だけの特例、typed の扱い）は候補に入れない。
 */
type Starter = { why: string; text: string };
const STARTERS: Record<"start" | "stuck", Starter[]> = {
  start: [
    { why: "イシューの報告者と同じ予想から", text: "同じ引数で呼べば記憶を返す" },
    { why: "書き方に目を向けて", text: "書き方まで同じなら記憶を返す" },
    { why: "型に目を向けて", text: "型が違えば別の呼び出しになる" },
    { why: "質問から入っても大丈夫", text: "型は関係ある？" },
    { why: "質問から入っても大丈夫", text: "順番は関係ないの？" },
  ],
  stuck: [
    { why: "短い一文でも試せます", text: "同じ引数で呼べば記憶を返す" },
    { why: "迷ったら質問に変えても", text: "型は関係ある？" },
    { why: "迷ったら質問に変えても", text: "書き方は関係ある？" },
  ],
};
const COPY: Record<Exclude<SupportKind, "none">, { title: string; body: string }> = {
  start: { title: "何を書けばいいかわからない？", body: "まずは、イシューの報告者と同じ予想から始められます。外れても、食い違う事例が次の手がかりになります。" },
  stuck: { title: "途中で止まっていますか？", body: "短い一文でも試せます。書きかけのままなら、質問に変えてもいいです。" },
  explore: { title: "探しものですか？", body: "用意した事例は一覧から自由に開けます。仮説なしで次の事例を見ることもできます。" },
  send: { title: "この一文で試してみますか？", body: "読み取りは済んでいます。合っていなくても、食い違う事例が次の手がかりになります。" },
};

export function SupportCard({ kind, source, busy, onInsert, onNext, onOpenMap, onSend, onClose }: {
  kind: Exclude<SupportKind, "none">; source: "jev" | "manual"; busy: boolean;
  onInsert: (text: string) => void; onNext: () => void; onOpenMap: () => void; onSend: () => void; onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const starters = kind === "start" || kind === "stuck" ? STARTERS[kind] : null;
  const starter = starters?.[index % starters.length];
  return <aside className="support-card" role="status" aria-label="助け舟" data-kind={kind}>
    <div className="support-head"><h3>{COPY[kind].title}</h3><button className="text-button" onClick={onClose}>閉じる</button></div>
    <p>{COPY[kind].body}</p>
    {starter && <><blockquote>{starter.text}</blockquote><span className="small-note">{starter.why}</span>
      <div className="row"><button className="ghost" disabled={busy} onClick={() => onInsert(starter.text)}>これを入れてみる</button><button className="text-button" onClick={() => setIndex(index + 1)}>こんなのは？（別の候補）</button></div></>}
    {kind === "explore" && <div className="row"><button className="ghost" disabled={busy} onClick={onOpenMap}>事例の一覧を開く</button><button className="ghost" disabled={busy} onClick={onNext}>仮説なしで次の事例を見る</button></div>}
    {kind === "send" && <div className="row"><button disabled={busy} onClick={onSend}>この仮説で次の例を探す →</button></div>}
    <p className="small-note">{source === "jev" ? "経過時間・文字数・スクロール・ポインタの動きから出しています。入力した文は見ていません。" : "ヒントは何度でも開けます。"}</p>
  </aside>;
}
