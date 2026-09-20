"use client";
import { useEffect, useRef, useState } from "react";
import { DECISIONS, type ReviewDecision, type Submission } from "@/lib/review";
import { LRU_CASES, LRU_HOLDOUT, LRU_LABEL, type LruOutcome } from "@/subject/lru";
import { NarrationView } from "./narration-view";

function Holdout() {
  const [prediction, setPrediction] = useState<LruOutcome | null>(null);
  return <section className="holdout" aria-label="未提示事例の予想">
    <h3>{LRU_HOLDOUT.title}</h3>
    <p>{LRU_HOLDOUT.situation}</p>
    <p><code>{LRU_HOLDOUT.calls.join(" → ")}</code></p>
    <p className="small-note">予想を選んでから実測を見ます。クリア判定は変わりません。予想は保存・送信しません。</p>
    <div className="secondary-actions" role="group" aria-label="2回目の結果を予想する">
      {(["remembered", "computed", "error"] as const).map((outcome) => <button key={outcome} className="ghost" disabled={prediction !== null} aria-pressed={prediction === outcome} onClick={() => setPrediction(outcome)}>{LRU_LABEL[outcome]}</button>)}
    </div>
    {prediction !== null && <div role="status">
      <p>あなたの予想：{LRU_LABEL[prediction]}</p>
      <p>実測：<strong>{LRU_LABEL[LRU_HOLDOUT.actual]}</strong></p>
      <p>{LRU_HOLDOUT.observation}</p>
      <p>{prediction === LRU_HOLDOUT.actual ? "予想と実測が一致しました。あなたの説明のどこが、この結果につながりましたか？" : "予想と実測が食い違いました。あなたの説明のどこを見直せそうですか？"}</p>
      <a href={`${LRU_HOLDOUT.evidence.url}#L${LRU_HOLDOUT.evidence.line}`} target="_blank" rel="noreferrer">{LRU_HOLDOUT.evidence.title} のコードを見る</a>
    </div>}
  </section>;
}

export function ReviewPanel({ initialHypothesis, initialReview, onBusy }: { initialHypothesis: string; initialReview: string; onBusy: (busy: boolean) => void }) {
  const [hypothesis, setHypothesis] = useState(initialHypothesis);
  const [review, setReview] = useState(initialReview);
  const [decision, setDecision] = useState<ReviewDecision>("hold");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [receipt, setReceipt] = useState<Submission | null>(null);
  const requestId = useRef<string | null>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/review", { cache: "no-store", signal: abort.signal }).then(async (r) => {
      if (!r.ok) throw new Error("history unavailable");
      const data = await r.json(); if (!abort.signal.aborted) setSubmissions(data.submissions);
    }).catch(() => { if (!abort.signal.aborted) setError("提出履歴を読み込めませんでした。入力して提出することはできます。"); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  async function submitReview() {
    if (lock.current || !hypothesis.trim() || !review.trim()) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hypothesis, review, decision, requestId: requestId.current }), signal: abort.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "提出に失敗しました。");
      setReceipt(data.submission); setSubmissions((old) => [...old.filter((s) => s.id !== data.submission.id), data.submission]);
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "提出に失敗しました。"); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section className="review-panel" aria-label="最終レビュー提出">
    <h3>あなたのレビューを提出する</h3>
    <p className="small-note">このアプリ内の提出です。GitHubには投稿しません。提出文・確認した質問・実測をOllama Cloudへ、生成文と根拠をJevへ送って解説を作ります。秘密情報は入力しないでください。</p>
    <label htmlFor="final-hypothesis">最後の仮説（現状の実装をどう説明する？）</label>
    <textarea id="final-hypothesis" value={hypothesis} maxLength={1000} disabled={busy} onChange={(e) => { setHypothesis(e.target.value); requestId.current = null; }} />
    <label htmlFor="review-decision">このPRへの判断</label>
    <select id="review-decision" value={decision} disabled={busy} onChange={(e) => { setDecision(e.target.value as ReviewDecision); requestId.current = null; }}>{Object.entries(DECISIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <label htmlFor="review">あなたのレビューコメント（下書き・外部には投稿されません）</label>
    <textarea id="review" value={review} maxLength={3000} disabled={busy} onChange={(e) => { setReview(e.target.value); requestId.current = null; }} />
    <button disabled={busy || !hypothesis.trim() || !review.trim()} onClick={() => void submitReview()}>{busy ? "照合・解説を生成し、検問しています…" : "レビューを提出して回答を受け取る"}</button>
    {error && <p role="alert" className="err">{error}</p>}
    {receipt && <section className="review-receipt" aria-label="提出への回答" role="status"><h3>レビューを受け付けました</h3><p>{DECISIONS[receipt.decision]} · {new Date(receipt.at).toLocaleString("ja-JP")}</p><blockquote>{receipt.hypothesis}</blockquote><p>説明が通るテスト：<strong>{receipt.stage}</strong></p><p>{receipt.cleared ? "用意した7事例では、読み取った説明と実測が一致しました。確認範囲はこの7つだけです。" : receipt.reading ? "食い違い、または読み取りが確定していない事例が残っています。" : "読み取りができず、照合は未確定です。"}</p><p>{receipt.unasked ? "まだ質問していない論点があります。" : "用意した質問の論点には触れました。"}理解度やマージ判断の採点ではありません。</p><NarrationView narration={receipt.narration} />
      <details><summary>この提出の照合と根拠を見る</summary><p className="small-note">予想はJevの読み取りをコードで適用したもの。実測と区別して見てください。</p><div className="review-results">{receipt.results.map((result) => { const card = LRU_CASES.find((c) => c.id === result.id)!; return <div key={result.id}><strong>{result.id} · {result.verdict === "match" ? "一致" : result.verdict === "mismatch" ? "食い違い" : "読み取り未確定"}</strong><code>{card.calls.join(" → ")}</code><span>予想：{LRU_LABEL[result.prediction]} / 実測：{LRU_LABEL[card.actual]}</span></div>; })}</div><p>提出コメント：{receipt.review}</p></details>
      {receipt.cleared && <Holdout key={receipt.id} />}
    </section>}
    {submissions.length > 0 && <details className="submission-history"><summary>保存した提出履歴 · {submissions.length}件</summary>{submissions.map((submission) => <div key={submission.id}><p>{submission.hypothesis}</p><button className="ghost" disabled={busy} onClick={() => setReceipt(submission)}>{new Date(submission.at).toLocaleTimeString("ja-JP")} の回答を見直す</button></div>)}</details>}
  </section>;
}
