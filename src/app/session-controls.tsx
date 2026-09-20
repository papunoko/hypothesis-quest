"use client";

import { useRef, useState } from "react";

export function SessionControls({ disabled, onResetting }: { disabled: boolean; onResetting: (busy: boolean) => void }) {
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function reset() {
    if (disabled || lock.current) return;
    if (!window.confirm("新しいセッションを始めますか？\n\nこのアプリのセッションCookieを切り替えます。現在の帳面・提出履歴にはこの画面から戻れなくなり、入力中の下書きも消えます。サーバーに保存済みのデータは削除しません。\n\n同じブラウザの他のタブもCookieを共有します。他のタブで続ける前に再読み込みしてください。")) return;
    lock.current = true; onResetting(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "セッションを切り替えられませんでした。");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信に失敗しました。");
      lock.current = false; onResetting(false);
    }
  }
  return <div className="session-controls">
    <button className="text-button" disabled={disabled} onClick={() => void reset()}>新しいセッションを始める</button>
    {error && <p role="alert" className="err">{error}</p>}
  </div>;
}
