import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "仮説クエスト",
  description: "CPythonの実イシューを背景に、仮説と実測事例を比べてPRレビューを書く小さなコード探索",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
