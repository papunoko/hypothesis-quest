import type { Narration } from "@/lib/narration";

export function NarrationView({ narration }: { narration: Narration }) {
  return <section className="narration-box" aria-label="相棒の回答">
    <span className="eyebrow">{narration.source === "generated" ? "LLM生成 · Jev検問通過" : "定型回答 · 生成文は未表示"}</span>
    <p style={{ whiteSpace: "pre-wrap" }}>{narration.text}</p>
    {narration.source === "fallback" && <p className="small-note">{narration.reason === "screened" ? "生成文を根拠と照合した結果、表示を見送りました。" : "生成または検問を完了できなかったため、確認済みの定型文を表示しています。"}</p>}
    {narration.source === "generated" && <p className="small-note">モデルによる検問であり、誤りがない保証ではありません。根拠の事例も確認してください。</p>}
  </section>;
}
