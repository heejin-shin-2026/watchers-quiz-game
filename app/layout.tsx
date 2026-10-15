import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watchers 실시간 퀴즈",
  description: "2026-10-17 Watchers 개강총회 실시간 퀴즈 게임",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
