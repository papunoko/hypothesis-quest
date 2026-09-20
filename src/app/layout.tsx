import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "仮説クエスト",
  description: "AIが書いた機能について仮説を書き、その説明では扱えない事例を見つける",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
