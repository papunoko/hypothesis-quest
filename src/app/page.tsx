"use client";

import { useEffect, useRef, useState } from "react";
import { LRU_AXES, LRU_CASES, LRU_EXTRA, LRU_LABEL, LRU_SOURCE, LRU_UNEXPLORED, LRU_HOLDOUT_PROMPT, type LruAxis, type LruCase, type LruReading } from "@/subject/lru";
import type { LruResult } from "@/lib/lru-select";
import type { InputReading, InputKind } from "@/lib/lru-input";
import type { NotebookEntry } from "@/lib/notebook-types";
import { QUESTION_TOPICS, type QuestionAnswer } from "@/subject/lru-questions";
import type { Narration } from "@/lib/narration";
import { NarrationView } from "./narration-view";
import { ReviewPanel } from "./review-panel";
import { SupportCard } from "./support-card";
import { SessionControls } from "./session-controls";
import type { SupportKind } from "@/lib/support";

const AXES = Object.keys(LRU_AXES) as LruAxis[];
type Turn = { hypothesis: string; id: string; note: string };
type ResponseData = Partial<InputReading> & { reading: LruReading; results: LruResult[]; next: string | null; error?: string; entries?: NotebookEntry[]; question?: QuestionAnswer; message?: string; clarify?: boolean; narration?: Narration; entryId?: string };

function Story() {
  return <div className="story-grid">
    <article className="story-card">
      <div className="eyebrow">01 / 実在のバグ報告 · 2020</div>
      <h2>「1と1.0は等しいのに、キャッシュが外れる」</h2>
      <p>Pythonの<code>lru_cache</code>は、関数の結果を覚えて再利用する仕組みです。報告者は「<code>typed=False</code>なら、<code>f(1)</code>の後の<code>f(1.0)</code>は、保存した結果を使うはず」と考えました。</p>
      <p>ところが実際にはもう一度計算される。この期待と実装のずれが <a href="https://bugs.python.org/issue39554" target="_blank" rel="noreferrer">bpo-39554</a> です。<code>1 == 1.0</code>はTrueですが、型はintとfloatで異なります。</p>
    </article>
    <article className="story-card pr-card">
      <div className="eyebrow">02 / 届いたPR · 演習用・架空</div>
      <h2>「typed=Falseなら、1と1.0を同じ扱いにする」</h2>
      <p>作者の提案：「値が等しいのに外れるのはバグでは？ <code>_make_key</code>の近道を外して、同じ作り方のキーで比較するようにしました。1と1.0が当たるテストも足しました。」</p>
      <div className="pr-summary"><strong>このPRは演習用の架空の提案です。</strong><br />実在の報告者の期待を、レビューできる形に組み直しています。実際に提出・マージされたPRではありません。</div>
      <details><summary>提案されている変更を見る（演習用差分）</summary><pre><code>{"# Lib/functools.py / _make_key\n- elif len(key) == 1 and type(key[0]) in fasttypes:\n-     return key[0]\n  return _HashedSeq(key)"}</code></pre><p className="small-note">これから試す事例は、この変更を入れる前のCPython 3.12.3の振る舞いです。</p></details>
    </article>
  </div>;
}

export default function LruQuest() {
  const [started, setStarted] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [composing, setComposing] = useState(false);
  const [preview, setPreview] = useState<({ hypothesis: string; reading: LruReading } & Partial<InputReading>) | null>(null);
  const [readingState, setReadingState] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const [current, setCurrent] = useState<LruCase | null>(null);
  const [results, setResults] = useState<LruResult[]>([]);
  const [confirmed, setConfirmed] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [reviewOpened, setReviewOpened] = useState(false);
  const [holdoutSeen, setHoldoutSeen] = useState(false);
  const [extra, setExtra] = useState(false);
  const [review, setReview] = useState("");
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [notebookReady, setNotebookReady] = useState(false);
  const [notebookError, setNotebookError] = useState("");
  const [question, setQuestion] = useState<QuestionAnswer | null>(null);
  const [message, setMessage] = useState("");
  const [clarify, setClarify] = useState(false);
  const [narration, setNarration] = useState<Narration | null>(null);
  const [questionEntryId, setQuestionEntryId] = useState<string | null>(null);
  const [hint, setHint] = useState<Narration | null>(null);
  const [support, setSupport] = useState<{ kind: Exclude<SupportKind, "none">; source: "jev" | "manual" } | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const inputColumn = useRef<HTMLElement>(null);
  const caseMap = useRef<HTMLDetailsElement>(null);
  // 行動シグナル（数だけ）。事例が切り替わるたびに初期化する。入力文は /api/support に送らない。
  const signals = useRef({ caseAt: Date.now(), inputAt: 0, scrolls: 0, depth: 0, moves: 0, lastMove: 0, focused: false });
  const supportDismissed = useRef(new Set<SupportKind>());
  const supportBusy = useRef(false);
  const supportAt = useRef(0);
  const supportSequence = useRef(0);
  const supportController = useRef<AbortController | null>(null);
  const latest = useRef({ started: false, ended: false, busy: false, composing: false, support: false, hypothesis: "", readingFresh: false, casesSeen: 0, submissions: 0, submitted: false });
  const readController = useRef<AbortController | null>(null);
  const readSequence = useRef(0);
  const composingRef = useRef(false);
  const submitLock = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  function revealResult() {
    requestAnimationFrame(() => {
      inputColumn.current?.scrollTo({ top: 0, behavior: "instant" });
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  useEffect(() => { if (started) revealResult(); }, [started, ended, current, question, message]);

  function invalidateSupport() {
    ++supportSequence.current;
    supportController.current?.abort();
    setSupport(null);
  }

  useEffect(() => {
    if (!started) return;
    let active = true;
    fetch("/api/notebook", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("notebook unavailable");
      const data: { entries: NotebookEntry[] } = await response.json();
      if (!active) return;
      setEntries(data.entries);
      const seen = data.entries.flatMap((entry) => entry.cases);
      setShown((ids) => [...new Set([...ids, ...seen])]);
      const lastTheory = data.entries.findLast((entry) => entry.kind === "assertion");
      if (lastTheory) { setConfirmed(lastTheory.hypothesis); setResults(lastTheory.results ?? []); }
    }).catch(() => { if (active) setNotebookError("帳面を読み込めませんでした。観察は続けられます。"); })
      .finally(() => { if (active) setNotebookReady(true); });
    return () => { active = false; };
  }, [started]);

  useEffect(() => {
    const sequence = ++readSequence.current;
    readController.current?.abort();
    const text = hypothesis.trim();
    if (!started || composing || busy || ended || text.length < 4) { setReadingState("idle"); return; }
    if (text === preview?.hypothesis) { setReadingState("ready"); return; }
    const controller = new AbortController();
    readController.current = controller;
    setReadingState("waiting");
    const timer = setTimeout(async () => {
      setReadingState("reading");
      try {
        const response = await fetch("/api/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hypothesis: text, subject: "lru" }), signal: controller.signal });
        if (!response.ok) throw new Error("read failed");
        const data = await response.json();
        if (sequence !== readSequence.current || controller.signal.aborted) return;
        setPreview({ ...data, hypothesis: text }); setReadingState("ready");
      } catch { if (!controller.signal.aborted && sequence === readSequence.current) setReadingState("error"); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [hypothesis, composing, started, busy, ended, preview]);

  function resetSignals() {
    signals.current = { ...signals.current, caseAt: Date.now(), inputAt: 0, scrolls: 0, moves: 0 };
    supportDismissed.current.clear(); invalidateSupport();
  }
  useEffect(() => {
    if (!started) return;
    const onScroll = () => {
      const s = signals.current; s.scrolls++;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      s.depth = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const onMove = () => { const s = signals.current; const now = Date.now(); if (now - s.lastMove >= 250) { s.lastMove = now; s.moves++; } };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { document.removeEventListener("scroll", onScroll, { capture: true }); window.removeEventListener("pointermove", onMove); };
  }, [started]);

  // 5秒ごとに「止まっているか」を見る。事例表示から15秒・前回から12秒は空け、打っている最中（6秒以内）は投げない。
  // 判定は Jev。文言はコード。失敗したら1分黙る。
  useEffect(() => {
    if (!started || ended) return;
    const probe = async () => {
      const l = latest.current; const s = signals.current; const now = Date.now();
      if (!l.started || l.ended || l.busy || l.composing || l.support || l.submitted || supportBusy.current || document.visibilityState !== "visible") return;
      const secondsOnCase = (now - s.caseAt) / 1000;
      const secondsSinceInput = s.inputAt ? (now - s.inputAt) / 1000 : secondsOnCase;
      if (secondsOnCase < 15 || now - supportAt.current < 12_000 || secondsSinceInput < 6) return;
      supportBusy.current = true; supportAt.current = now;
      const sequence = supportSequence.current;
      const controller = new AbortController();
      supportController.current = controller;
      try {
        const response = await fetch("/api/support", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals: {
          secondsOnCase: Math.round(secondsOnCase), secondsSinceInput: Math.round(secondsSinceInput), inputChars: l.hypothesis.trim().length,
          scrollCount: s.scrolls, scrollDepth: Math.round(s.depth * 100) / 100, pointerMoves: s.moves, casesSeen: l.casesSeen, submissions: l.submissions,
          readingReady: l.readingFresh, focused: s.focused,
        } }) });
        if (!response.ok) throw new Error("support unavailable");
        const data: { kind: SupportKind; offer: boolean } = await response.json();
        const active = latest.current;
        if (sequence !== supportSequence.current || controller.signal.aborted || active.ended || active.busy || active.composing || active.submitted || active.support || document.visibilityState !== "visible") return;
        if (data.offer && data.kind !== "none" && !supportDismissed.current.has(data.kind) && (data.kind !== "send" || active.readingFresh && !!active.hypothesis.trim())) setSupport({ kind: data.kind, source: "jev" });
      } catch { if (!controller.signal.aborted) supportAt.current = Date.now() + 48_000; }
      finally { supportBusy.current = false; }
    };
    const timer = setInterval(() => void probe(), 5000);
    return () => { clearInterval(timer); ++supportSequence.current; supportController.current?.abort(); };
  }, [started, ended]);
  function show(card: LruCase) {
    if (busy) return;
    resetSignals();
    setQuestion(null); setMessage("");
    setCurrent(card); setShown((ids) => ids.includes(card.id) ? ids : [...ids, card.id]); setEnded(false);
  }
  function finish() {
    if (busy) return;
    invalidateSupport();
    setReviewOpened(true);
    setCurrent(null); setQuestion(null); setMessage(""); setEnded(true);
    const latestTheory = entries.findLast((entry) => entry.kind === "assertion")?.hypothesis;
    setReview(`現状の実装についての私の理解：${latestTheory || confirmed || "まだ一文では説明できていません。"}\n\nこのPRの判断：\n追加で確かめたいこと：`);
  }
  async function submit(kind?: InputKind) {
    const text = hypothesis.trim();
    if (!text || busy || ended || !notebookReady || composingRef.current || submitLock.current) return;
    submitLock.current = true; ++readSequence.current; readController.current?.abort(); invalidateSupport(); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "lru", hypothesis: text, shown, kind }) });
      const data: ResponseData = await response.json();
      if (!response.ok) throw new Error(data.error || "Jevに接続できませんでした。");
      setPreview({ ...data, hypothesis: text });
      if (data.clarify) { setClarify(true); return; }
      setLastSubmitted(text);
      setClarify(false);
      if (data.entries) { setEntries(data.entries); setNotebookError(""); }
      if (data.kind === "question" || data.kind === "other") {
        setNarration(data.narration ?? null); setQuestionEntryId(data.entryId ?? null); setHint(null);
        resetSignals();
        setQuestion(data.question ?? null); setMessage(data.message ?? ""); setCurrent(null); setResults([]);
        setShown((ids) => [...new Set([...ids, ...data.question?.cases ?? []])]);
        return;
      }
      setResults(data.results); setConfirmed(text);
      if (!data.next) {
        finish(); setReview(`現状の実装についての私の理解：${text}\n\nこのPRの判断：\n追加で確かめたいこと：`); setHistory((entries) => [...entries, { hypothesis: text, id: "", note: "用意した事例を確認して終了" }]);
      } else {
        const card = LRU_CASES.find((c) => c.id === data.next)!; show(card);
        const result = data.results.find((r) => r.id === card.id)!;
        setHistory((entries) => [...entries, { hypothesis: text, id: card.id, note: result.verdict === "mismatch" ? "予想と食い違い" : result.verdict === "match" ? "この例では一致" : "読み取りを確認" }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "接続に失敗しました。"); }
    finally { setBusy(false); submitLock.current = false; }
  }
  async function explain() {
    if (busy || !questionEntryId) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: questionEntryId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setHint(data.narration); setEntries(data.entries);
    } catch { setError("解説を受け取れませんでした。質問の実測は引き続き確認できます。"); }
    finally { setBusy(false); }
  }
  const result = current ? results.find((r) => r.id === current.id) : undefined;
  const pair = current?.id === "L5" ? LRU_CASES[5] : current?.id === "L6" ? LRU_CASES[4] : null;
  const readingFresh = preview?.hypothesis === hypothesis.trim();
  // 表示専用の話題関連度。主張の肯否・正しさ・クリア判定から分離する。
  const coreness = !hypothesis.trim() ? 0 : readingFresh && !composing ? preview.coreRelevance ?? null : null;
  const sendLabel = readingFresh && preview?.kind === "question" ? "この質問で調べる →" : "この仮説で次の例を探す →";
  const chip = composing ? { kind: "composing", label: "変換中" } : !readingFresh || !preview?.kind ? { kind: "none", label: "—" } : preview.needsKind ? { kind: "unsure", label: "質問？ 仮説？" } : preview.kind === "question" ? { kind: "question", label: "質問" } : preview.kind === "assertion" ? { kind: "assertion", label: "仮説" } : { kind: "other", label: "その他" };
  useEffect(() => { latest.current = { started, ended, busy, composing, support: support !== null, hypothesis, readingFresh, casesSeen: shown.length, submissions: Math.max(entries.length, history.length), submitted: !!lastSubmitted && hypothesis.trim() === lastSubmitted }; });
  const nextUnseen = LRU_CASES.find((c) => !shown.includes(c.id));
  // 条件の軸だけを映す。条件がひとつも映らないときだけ「ルールを述べている」を出し、鏡を空にしない。
  // 表示閾値 0.35: 0.2 台の薄い反応まで映すと、触れていない軸（例: 1個だけの特例）の名前が漏れる
  const MIRROR_MIN = 0.35;
  const conditionAxes = readingFresh ? AXES.filter((axis) => axis !== "rule" && preview.reading[axis] >= MIRROR_MIN) : [];
  const visibleAxes = conditionAxes.length > 0 ? conditionAxes : readingFresh && preview.reading.rule >= MIRROR_MIN ? (["rule"] as LruAxis[]) : [];
  const askedTopics = [...new Set(entries.flatMap((entry) => entry.question?.topic ? [entry.question.topic] : []))];

  return <main className="lru-app">
    <header className="quest-header"><a className="wordmark" href="/">仮説クエスト<span>読む前に、自分の説明を試す。</span></a><div className="quest-actions"><span className="subject-tag">LLM回答・レビュー提出版</span><SessionControls disabled={busy || (started && !notebookReady)} onResetting={(resetting) => { if (resetting) { invalidateSupport(); ++readSequence.current; readController.current?.abort(); } setBusy(resetting); }} /></div></header>
    {!started ? <>
      <section className="intro-hero"><div className="eyebrow">あなたはCPythonのメンテナ。今日はPRをレビューします。</div><h1>「同じ引数」のはずなのに。<br />この修正、マージしていい？</h1><p>届いたのは「1と1.0を同じ呼び出しとして扱う」という提案。<br />判断する前に、いまの実装が何を「同じ」とみなしているか、あなたの言葉で確かめます。</p></section>
      <Story />
      <section className="setup-card"><div><div className="eyebrow">まず、ここだけわかれば大丈夫</div><h2>計算結果を覚えて、次に使い回す</h2><p><code>f</code>は重い計算をする関数。<code>y=0</code>は「2つ目の値を省略したら0」という意味です。キャッシュに当たれば、本体をもう一度動かさず結果を返します。</p><p className="small-note">イシューの論点を、この小さな関数で再現します。実測はCPython 3.12.3。これは説明用の関数で、PRの追加コードではありません。</p></div><pre><code>{"@lru_cache(maxsize=None)\ndef f(x, y=0):\n    return x + y  # 重い計算の代わり\n\nf(1)     # x=1, y=0\nf(1, 0)  # こちらも x=1, y=0"}</code></pre></section>
      <div className="start-row"><button disabled={busy} onClick={() => { setStarted(true); show(LRU_CASES[0]); }}>このイシューを確かめる →</button><span>現状を観察 → 自分の説明を試す → レビューコメントを書く</span></div>
      <footer className="scope-note">扱うのは「呼び出しの同一性」。保存件数や追い出し順序は今回の範囲外です。<a href="/orders">開発用の注文API</a></footer>
    </> : <>
      <details className="context-recap"><summary>何のイシュー・PRだった？ 背景を読み返す</summary><Story /></details>
      <section className="workspace">
        <div className="explore-column">
          <div className="section-heading" ref={resultRef} tabIndex={-1}><div><div className="eyebrow">OBSERVE / 呼び出しを比べる</div><h1>何が「同じ」を分けている？</h1></div><span>{shown.length} / 7 事例</span></div>
          {question && <article className="observation-card question-answer" aria-label="質問への返答">
            <div className="eyebrow">ASK / 検証済みの比較から答える</div>
            <p className="small-note">質問を次の形で読み替えて回答しています。意味が違ったら書き直してください。</p>
            <h2>{question.question}</h2><strong className="answer-word">{question.answer}</strong>
            {question.core && <p>この質問は、今回のPRの論点の中心に触れています。</p>}
            <p>{question.note}</p>
            <div className="question-cases">{question.cases.map((id) => { const card = LRU_CASES.find((c) => c.id === id)!; return <section key={id}><span>{id} · typed={card.typed ? "True" : "False"}</span><pre><code>{card.calls.join("\n↓\n")}</code></pre><strong>{LRU_LABEL[card.actual]}</strong><p className="small-note">本体の実行は{card.actual === "remembered" ? "1" : "2"}回</p><button className="ghost" onClick={() => show(card)}>観察と根拠を見る · {id}</button></section>; })}</div>
            <p className="small-note">各カードは空のキャッシュから実測。答えはJevの生成ではなく、この比較の結果から計算しています。</p>
            {narration && <NarrationView narration={narration} />}
            {questionEntryId && question.cases.length > 0 && !hint && <button className="ghost" disabled={busy} onClick={() => void explain()}>{busy ? "解説を生成・検問しています…" : "理由も知りたい（答えに近づくヒント）"}</button>}
            {hint && <NarrationView narration={hint} />}
          </article>}
          {!question && message && <p className="observation-card" role="status">{message}</p>}
          {current && <article className="observation-card">
            <div className="case-meta"><span>{current.id} / CPython 3.12.3</span><span>typed={current.typed ? "True" : "False"}</span></div>
            <h2>{current.title}</h2><p>{current.situation}</p>
            <div className="call-pair">{current.calls.map((call, i) => <div key={i}><span>{i === 0 ? "1回目：まず覚える" : "2回目：記憶を使える？"}</span><code>{call}</code></div>)}</div>
            <p className="small-note">各事例は空のキャッシュから開始。比べるのは2回目の動作です。<code>f(x, y=0)</code> / maxsize=None</p>
            <div className="lru-comparison"><div><span>あなたの仮説からの予想</span><strong>{result ? LRU_LABEL[result.prediction] : "まずは実際の動きを観察"}</strong>{result && <p className="small-note">試した仮説：「{confirmed}」</p>}</div><div className="observed"><span>実際に起きたこと</span><strong>{LRU_LABEL[current.actual]}</strong><p>{current.observation}</p></div></div>
            {result && <p className={`reading-verdict ${result.verdict}`} role="status">{result.verdict === "mismatch" ? "予想と食い違いました。この違いを説明に足すと、どうなりそう？" : result.verdict === "match" ? "この事例では、仮説からの予想と実際の結果が一致しました。" : "読み取りを確認：まだ予想を断定できません。入力欄の下の「読み取りの内訳」を開いて見直してみてください。"}</p>}
            <div className="companion">{current.companion}</div>
            {pair && <div className="pair-invitation"><strong>1個と2個、並べて確かめる</strong>{shown.includes(pair.id) ? <div className="contrast-pair">{[LRU_CASES[4], LRU_CASES[5]].map((c) => <div key={c.id}><span>{c.id} · {c.calls.join(" → ")}</span><b>{LRU_LABEL[c.actual]}</b></div>)}</div> : <button className="ghost" disabled={busy} onClick={() => show(pair)}>{pair.id}「{pair.title}」も見る</button>}</div>}
            <details className="evidence"><summary>根拠を見る：イシューと実装のどこ？</summary><p><a href={current.evidence.url} target="_blank" rel="noreferrer">{current.evidence.title} ↗</a> · <a href={`${LRU_SOURCE}#L${current.evidence.line}`} target="_blank" rel="noreferrer">CPython 3.12.3の該当行 ↗</a></p><pre><code>{current.evidence.code}</code></pre><p className="small-note">実行結果は scripts/verify-lru.py で再検証できます。純Python実装の対応箇所へのリンクです。</p></details>
          </article>}
          {reviewOpened && <article className="observation-card ending" hidden={!ended}><h2>{shown.length === 7 ? "7つの事例を見終えました。" : `${shown.length}つの事例から、レビューを書く。`}</h2><p>見たことと、すべて説明できたことは別です。マージするか、見送るか、追加の確認が必要か。あなたの判断を言葉にしてみてください。</p><button className="ghost" disabled={busy} onClick={() => show(LRU_CASES.find((card) => card.id === shown.at(-1)) ?? LRU_CASES[0])}>質問・観察を続ける</button><p className="small-note">帳面・レビュー下書き・提出済みの回答を残して戻れます。</p><ReviewPanel initialHypothesis={entries.findLast((entry) => entry.kind === "assertion")?.hypothesis || confirmed} initialReview={review} onBusy={setBusy} onHoldoutSeen={() => setHoldoutSeen(true)} /><details className="evidence"><summary>実際のメンテナの返答と比べる</summary><p>bpo-39554では、Raymond Hettingerは「typed=Falseは等しい値を必ず同一視する約束ではなく、別扱いする余地を残す。その自由度でint向けの省スペース経路を設けた」と説明しています（要約）。</p><p><a href="https://bugs.python.org/issue39554" target="_blank" rel="noreferrer">実際の議論を読む ↗</a> · 結末はnot a bug。あなたのコメントの採点ではありません。</p><pre><code>{"# 見つけた違いが表れる場所\nkey = args                       # 渡された引数の並び\nfor item in kwds.items():         # キーワードの順番\n    key += item\nif typed:                        # 型を含める設定\n    key += tuple(type(v) for v in args)\nelif len(key) == 1 and type(key[0]) in fasttypes:\n    return key[0]                # このPRが外す近道\nreturn _HashedSeq(key)"}</code></pre><a href={`${LRU_SOURCE}#L448`} target="_blank" rel="noreferrer">_make_keyの全体を見る ↗</a><p className="small-note">抜粋は対応箇所の説明です。PRを実際に適用した後の性能・メモリ使用量は、この探索では測定していません。</p></details><p>残った疑問と、下の未確認の論点も持ち帰ってください。</p><button disabled={busy} onClick={() => { setShown([]); setHistory([]); setResults([]); setConfirmed(""); setError(null); setExtra(false); show(LRU_CASES[0]); }}>この仮説でもう一周する</button></article>}
          <details className="case-map" ref={caseMap}><summary>用意した事例を見る · {shown.length}/7 確認済み</summary><p className="small-note">自由に開けます。表示しただけで、説明できたとは扱いません。</p>{LRU_CASES.map((c) => <button key={c.id} disabled={busy} className={shown.includes(c.id) ? "visited" : ""} onClick={() => show(c)}>{shown.includes(c.id) ? "✓" : "○"} {c.id} {c.title}</button>)}</details>
          <section className="unexplored"><h2>まだ確かめていないこと</h2><button className="ghost" onClick={() => setExtra(!extra)}>{extra ? "閉じる" : "L8 リストを渡すと？（別の論点）"}</button>{extra && <div className="extra-result"><code>{LRU_EXTRA.call}</code><p>{LRU_EXTRA.observation}</p><a href={`${LRU_SOURCE}#L443`} target="_blank" rel="noreferrer">ハッシュを作る箇所を見る ↗</a></div>}<ul>{LRU_UNEXPLORED.filter((text) => !holdoutSeen || text !== LRU_HOLDOUT_PROMPT).map((text) => <li key={text}>{text}</li>)}</ul></section>
        </div>
        <aside className="hypothesis-column" ref={inputColumn}>
          <section className="hypothesis-card"><div className="eyebrow">ASK & EXPLAIN / 質問と仮説</div><h2><label htmlFor="hypothesis">どんな呼び出しなら、記憶を使える？</label></h2><p>質問からでも、仮説からでも大丈夫。「型は関係ある？」と聞いたり、「同じ引数なら記憶を返す」と説明してみてください。</p>
            <textarea id="hypothesis" ref={input} value={hypothesis} maxLength={1000} disabled={busy || ended} placeholder="例：同じ引数で呼べば記憶を返す" onChange={(e) => { setHypothesis(e.target.value); setClarify(false); signals.current.inputAt = Date.now(); invalidateSupport(); }} onFocus={() => { signals.current.focused = true; }} onBlur={() => { signals.current.focused = false; }} onCompositionStart={() => { composingRef.current = true; ++readSequence.current; readController.current?.abort(); invalidateSupport(); setComposing(true); }} onCompositionEnd={() => { composingRef.current = false; setComposing(false); }} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} />
            <div className="reading-preview" data-state={readingState} aria-busy={readingState === "reading"}>
              <div className="reading-heading"><span className="input-chip" data-kind={chip.kind} aria-label="入力の種別">{chip.label}</span><span className="core-meter" aria-label="核心度"><span>核心度</span><i><b style={{ width: `${(coreness ?? 0) * 100}%` }} /></i><span>{coreness === null ? "—" : coreness.toFixed(1)}</span></span><span>{composing ? "文字を変換中" : readingState === "reading" ? "読み取り中…" : readingState === "waiting" ? "入力を待っています" : readingState === "error" ? "今は読み取れません" : readingFresh ? "読み取り済み" : "入力すると読みます"}</span></div>
              <p className="small-note">核心度は、核心の話題への関連度です。正しさや理解度ではありません。</p>
              {readingState === "error" ? <p className="small-note">読み取りは使えません（送信は可能です）。</p> : readingFresh && preview?.kind === "question" ? <p className="small-note">{!preview.needsTopic && preview.topic && preview.topic in QUESTION_TOPICS ? `話題：${QUESTION_TOPICS[preview.topic as keyof typeof QUESTION_TOPICS].label}` : "質問の範囲を確認しています"}</p> : <details className="reading-detail"><summary>読み取りの内訳</summary><div className={readingFresh && !composing ? "axis-list" : "axis-list provisional"}>{visibleAxes.map((axis) => <div className={preview!.reading[axis] < 0.6 ? "axis uncertain" : "axis"} key={axis}><span>{LRU_AXES[axis].label}{preview!.reading[axis] >= 0.4 && preview!.reading[axis] < 0.6 ? "（まだ読み切れていません）" : ""}</span><div role="meter" aria-label={LRU_AXES[axis].label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={readingFresh ? preview.reading[axis] : 0}><i style={{ width: `${readingFresh ? preview.reading[axis] * 100 : 0}%` }} /></div></div>)}{visibleAxes.length === 0 && <p className="small-note">まだ何も映っていません。</p>}</div><p className="small-note">棒は、文にその条件があるとJevが読んだ強さです。正しさの点数ではありません。</p></details>}
            </div>
            <button className="try-button" disabled={busy || ended || !notebookReady || !hypothesis.trim() || composing} onClick={() => void submit()}>{busy ? "入力を確かめています…" : sendLabel}</button>
            {clarify && <div className="kind-confirm" role="status"><p>質問と仮説のどちらとして読めばいいですか？ 混ざっている場合は、一文ずつ試せます。</p><button disabled={busy} onClick={() => void submit("question")}>質問として調べる</button><button className="ghost" disabled={busy} onClick={() => void submit("assertion")}>仮説として試す</button></div>}

            {error && <p role="alert" className="err">{error}</p>}
            {support && !ended && <SupportCard key={support.kind} kind={support.kind} source={support.source} busy={busy || composing || !notebookReady} sendLabel={sendLabel} inputKind={readingFresh ? preview?.kind : undefined}
              onInsert={(text) => { invalidateSupport(); setHypothesis(text); setClarify(false); signals.current.inputAt = Date.now(); input.current?.focus(); }}
              onNext={() => { setSupport(null); if (nextUnseen) { setResults([]); setConfirmed(""); setError(null); show(nextUnseen); } else { finish(); } }}
              onOpenMap={() => { setSupport(null); if (caseMap.current) { caseMap.current.open = true; caseMap.current.scrollIntoView({ behavior: "smooth", block: "start" }); } }}
              onSend={() => void submit()}
              onClose={() => { supportDismissed.current.add(support.kind); supportAt.current = Date.now() + 30_000; invalidateSupport(); }} />}
            <div className="secondary-actions">
              <button className="text-button" disabled={busy || ended} onClick={() => { if (nextUnseen) { setResults([]); setConfirmed(""); setError(null); show(nextUnseen); } else { finish(); } }}>{nextUnseen ? "仮説なしで、次の事例を観察する" : "事例の確認を終える"}</button>
              {!ended && <button className="text-button" disabled={busy} onClick={() => { invalidateSupport(); setSupport({ kind: hypothesis.trim() ? "stuck" : "start", source: "manual" }); }}>ヒント</button>}
              {!ended && <button className="ghost finish-button" disabled={busy} onClick={finish}>観察を区切ってレビューを書く</button>}
            </div>
          </section>
          <section className="history-card notebook"><h2>調べたことの帳面</h2><details className="privacy"><summary>保存と送信について</summary><p className="small-note">入力と返答はサーバーのD1データベースに保存します（開発中はローカルD1）。質問文と公開する事実はOllama Cloudへ、生成文と根拠はJevへ送信します。仮説欄は入力中もJevが読み取ります。秘密情報は入力しないでください。</p></details>{notebookError && <p role="alert">{notebookError}</p>}
            {entries.length > 0 && <><h3>比較で確かめたこと</h3>{askedTopics.length ? <ul>{askedTopics.map((topic) => { const q = entries.findLast((entry) => entry.question?.topic === topic)!.question!; return <li key={topic}>{QUESTION_TOPICS[topic].label}：{q.answer}（{q.cases.join(" / ")}の範囲）</li>; })}</ul> : <p className="small-note">質問への返答はまだありません。</p>}<p className="small-note">{askedTopics.length < Object.keys(QUESTION_TOPICS).length ? "まだ質問していない論点があります。名前は、あなたが触れるまで表示しません。" : "用意した質問の論点には触れました。理解できたという採点ではありません。"}</p>
            <ol>{entries.map((entry) => <li key={entry.id}><span>{entry.kind === "question" ? "質問" : entry.kind === "assertion" ? "仮説" : "入力"} · {new Date(entry.at).toLocaleTimeString("ja-JP")}</span><p>{entry.hypothesis}</p>{entry.question?.topic && <p className="small-note">読み替え：{entry.question.question}</p>}<strong>{entry.answer}</strong>{entry.narration && <details><summary>相棒の回答を読み返す</summary><NarrationView narration={entry.narration} />{entry.hint && <NarrationView narration={entry.hint} />}</details>}<div>{entry.cases.map((id) => <button key={id} className="text-button" disabled={busy} onClick={() => { setResults(entry.results ?? []); if (entry.kind === "assertion") setConfirmed(entry.hypothesis); show(LRU_CASES.find((c) => c.id === id)!); }}>{id}を見直す</button>)}</div></li>)}</ol></>}
            {entries.length === 0 && <><h3>説明がどう変わったか</h3>{history.length ? <ol>{history.map((turn, i) => <li key={i}><p>{turn.hypothesis}</p><span>{turn.id} · {turn.note}</span></li>)}</ol> : <p className="small-note">試した仮説と、そこから見つかった事例が残ります。</p>}</>}
            {!ended && <button className="ghost" disabled={busy} onClick={finish}>提出したレビューと回答を見る</button>}</section>
        </aside>
      </section>
    </>}
  </main>;
}
