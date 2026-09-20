"use client";

import { useMemo, useRef, useState } from "react";
import { CASES, OUTCOME_LABEL, UNEXPLORED, type CaseCard } from "@/subject/cases";
import type { CaseResult, Verdict } from "@/lib/select";
import { CONFIDENCE_THRESHOLD } from "@/lib/select";
import { AXES, AXIS_LABEL, type Reading } from "@/lib/jev";

type HistoryEntry = { hypothesis: string; caseId: string | null; verdict: Verdict | "exhausted" | "error" };

const byId = Object.fromEntries(CASES.map((c) => [c.id, c])) as Record<string, CaseCard>;

function Steps({ c }: { c: CaseCard }) {
  const lines = c.steps.map((s, i) => {
    const key = s.key ?? "なし";
    const note = s.note ? `   ← ${s.note}` : "";
    return `${i + 1}回目  Idempotency-Key: ${key}   { productId: "${s.productId}", qty: ${s.qty} }${note}`;
  });
  return <div className="steps">{lines.join("\n")}</div>;
}

export default function Page() {
  const [hypothesis, setHypothesis] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shown, setShown] = useState<string[]>([]);
  const [current, setCurrent] = useState<{ c: CaseCard; r: CaseResult } | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const remaining = useMemo(() => CASES.filter((c) => !shown.includes(c.id)), [shown]);

  async function submit() {
    const h = hypothesis.trim();
    if (!h || busy || ended) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis: h, shown }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReading(data.reading ?? null);
      if (data.next === null) {
        setCurrent(null);
        setEnded(h);
        setHistory((x) => [...x, { hypothesis: h, caseId: null, verdict: "exhausted" }]);
        return;
      }
      const r = (data.results as CaseResult[]).find((x) => x.id === data.next)!;
      setCurrent({ c: byId[data.next], r });
      setShown((s) => [...s, data.next]);
      setHistory((x) => [...x, { hypothesis: h, caseId: data.next, verdict: r.verdict }]);
      setFallback(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHistory((x) => [...x, { hypothesis: h, caseId: null, verdict: "error" }]);
    } finally {
      setBusy(false);
    }
  }

  // T-17: Jev が落ちたときは固定順で次の事例を開ける（予想なし）
  function openNextFixed() {
    const c = remaining[0];
    if (!c) return;
    setCurrent({ c, r: { id: c.id, prediction: "undetermined", confidence: 0, verdict: "undetermined" } });
    setShown((s) => [...s, c.id]);
    setFallback(true);
    setReading(null);
    setHistory((x) => [...x, { hypothesis: "予想なしで確認", caseId: c.id, verdict: "undetermined" }]);
    setError(null);
  }

  function rewrite() {
    inputRef.current?.focus();
  }

  const lowConfidence = current ? current.r.prediction !== "undetermined" && current.r.confidence < CONFIDENCE_THRESHOLD : false;

  return (
    <main>
      <header className="top">
        <h1>仮説クエスト</h1>
        <div className="scope">
          対象: 注文登録API（AIが書いた実装） / 論点: 再送と重複 / 事例 {shown.length}/{CASES.length}
        </div>
      </header>

      <div className="grid">
        <section>
          <div className="panel">
            <h2>比較する事例</h2>
            {!current && !ended && (
              <p className="muted">
                右の欄に、この仕組みが何を守っているかを一文で書いてください。あなたの説明では扱えない事例を1枚出します。
              </p>
            )}

            {current && (
              <div className="case">
                <div className="id">{current.c.id}</div>
                <h3>{current.c.title}</h3>
                <p>{current.c.situation}</p>
                <Steps c={current.c} />

                {fallback ? (
                  <p className="hint">
                    Jev に接続できなかったため予想なしで表示しています。実際の結果:{" "}
                    <b>{OUTCOME_LABEL[current.c.actual.outcome]}</b>（HTTP {current.c.actual.status}）
                    {remaining.length === 0 && <button onClick={() => {
                      setCurrent(null); setEnded(hypothesis.trim() || "仮説なし");
                    }}>確認を終える</button>}
                  </p>
                ) : (
                  <>
                    <div className="compare">
                      <div className="box">
                        <div className="label">あなたの仮説から Jev が読み取った予想</div>
                        <b>{OUTCOME_LABEL[current.r.prediction]}</b>
                        <div className="hint">判定強度 {(current.r.confidence * 100).toFixed(0)}%（読み取り確率から算出）</div>
                      </div>
                      <div className="box">
                        <div className="label">実際の結果（事前に実行して確認済み）</div>
                        <b>{OUTCOME_LABEL[current.c.actual.outcome]}</b>
                        <div className="hint">
                          HTTP {current.c.actual.status} / 登録 {current.c.actual.count} 件
                        </div>
                      </div>
                    </div>

                    {lowConfidence ? (
                      <div className="verdict undetermined">
                        解釈の確認: あなたの仮説だと、この場合は「{OUTCOME_LABEL[current.r.prediction]}」という読み方で合ってる？
                        <div className="row">
                          <button className="ghost" onClick={rewrite}>
                            いや、違う → 仮説を書き直す
                          </button>
                          <span className="hint">読み間違いは Jev 側の問題。あなたの理解の問題ではありません。</span>
                        </div>
                      </div>
                    ) : current.r.verdict === "mismatch" ? (
                      <div className="verdict mismatch">↑ 食い違い。今の説明では、この事例はこうならない。</div>
                    ) : current.r.verdict === "undetermined" ? (
                      <div className="verdict undetermined">今の説明は、この状況について何も言っていない。</div>
                    ) : (
                      <div className="verdict match">この事例は今の説明で扱えた。</div>
                    )}

                    {reading && (
                      <details style={{ marginTop: 8 }}>
                        <summary>Jev の読み取りを見る（仮説が条件として挙げているもの）</summary>
                        <ul className="plain">
                          {AXES.map((a) => (
                            <li key={a}>
                              {AXIS_LABEL[a]} <span className="muted">{(reading[a] * 100).toFixed(0)}%</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}

                <div className="companion">相棒「{current.c.companion}」</div>
                <div className="row">
                  <button onClick={rewrite}>こういうこと？（仮説を書き直す）</button>
                  <details>
                    <summary>根拠を見る</summary>
                    <div className="hint">
                      {current.c.codeRef} — src/subject/orders.ts / 検証: src/subject/orders.test.ts
                    </div>
                  </details>
                </div>
              </div>
            )}

            {ended && (
              <div className="case ending">
                <h3>用意した{CASES.length}事例を見終えました。</h3>
                <p>「{ended}」</p>
                <p>
                  <b>確認したのはこの{CASES.length}つだけです。</b> 全事例を見たことは、最後の仮説ですべて説明できたことを意味しません。まだ確かめていない論点:
                </p>
                <ul className="plain">
                  {UNEXPLORED.map((u) => (
                    <li key={u}>─ {u}</li>
                  ))}
                </ul>
                <p className="hint">
                  この区別がコードのどこに表れているか: src/subject/orders.ts（依頼IDの照合と fingerprint の比較）
                </p>
                <button onClick={() => {
                  setEnded(null); setCurrent(null); setShown([]); setHistory([]);
                  setReading(null); setFallback(false); setError(null);
                }}>この仮説でもう一度試す</button>
              </div>
            )}

            {error && (
              <div className="row">
                <span className="err">Jev 呼び出しに失敗: {error}</span>
                {remaining.length > 0 && (
                  <button className="ghost" onClick={openNextFixed}>
                    予想なしで次の事例を開く
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h2>調べたこと</h2>
            <ul className="plain">
              {CASES.map((c) => {
                const h = [...history].reverse().find((x) => x.caseId === c.id);
                const done = shown.includes(c.id);
                return (
                  <li key={c.id} className={current?.c.id === c.id ? "now" : ""}>
                    {done ? "✓" : "─"} {c.id} {c.title}
                    {h?.verdict === "mismatch" && <span className="muted">（食い違い）</span>}
                    {h?.verdict === "undetermined" && <span className="muted">（決まらない）</span>}
                    {h?.verdict === "match" && <span className="muted">（説明できた）</span>}
                    {!done && <span className="muted">（未提示）</span>}
                  </li>
                );
              })}
              {UNEXPLORED.map((u) => (
                <li key={u} className="muted">
                  ─ {u}（未確認）
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <div className="panel">
            <h2>いまの仮説 — この仕組みは、何を守っている？</h2>
            <textarea
              ref={inputRef}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="例: 同じ商品は重複して登録しない"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
            <div className="row">
              <button onClick={submit} disabled={busy || !hypothesis.trim() || !!ended}>
                {busy ? "Jev が読んでいます…" : "この仮説で試す"}
              </button>
              <span className="hint">Ctrl+Enter でも送れます。正誤の採点はしません。</span>
            </div>
            <p className="hint">Jev は仮説文だけを読みます。事例への当てはめと、実際の結果との照合はコードが行います。</p>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h2>履歴 — 自分の考えがどう変わったか</h2>
            {history.length === 0 ? (
              <p className="muted">まだありません。</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {history.map((h, i) => (
                  <li key={i} className={i === history.length - 1 ? "now" : ""}>
                    {h.hypothesis}
                    <span className="muted">
                      {" "}
                      → {h.caseId ?? ""}
                      {h.verdict === "mismatch" && " 食い違い"}
                      {h.verdict === "undetermined" && " 決まらない"}
                      {h.verdict === "match" && " 説明できた"}
                      {h.verdict === "exhausted" && " 6事例を確認して終了"}
                      {h.verdict === "error" && " Jev 失敗"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h2>助けて</h2>
            <details>
              <summary>ヒント1</summary>
              <p className="hint">2つの事例を並べて、違う値を探してみて。</p>
            </details>
            <details>
              <summary>ヒント2</summary>
              <p className="hint">商品コード以外で違う値がある。</p>
            </details>
            <details>
              <summary>ヒント3</summary>
              <p className="hint">依頼ID（Idempotency-Key）が、誰によっていつ作られるかに注目。</p>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
