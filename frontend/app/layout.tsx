import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Edu Image Platform",
  description: "AI 教辅批量生图平台项目骨架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
