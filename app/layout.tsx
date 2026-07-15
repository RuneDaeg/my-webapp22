import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "과제 채점 도우미",
  description: "학생 과제 업로드와 AI 채점/피드백/세특 초안 작성을 돕는 도구",
  // 링크를 공유했을 때 미리보기가 제대로 뜨도록 (Open Graph)
  openGraph: {
    title: "과제 채점 도우미",
    description: "학생 과제 업로드와 AI 채점/피드백/세특 초안 작성을 돕는 도구",
    type: "website",
    locale: "ko_KR",
    siteName: "과제 채점 도우미",
  },
  twitter: {
    card: "summary",
    title: "과제 채점 도우미",
    description: "학생 과제 업로드와 AI 채점/피드백/세특 초안 작성을 돕는 도구",
  },
  robots: { index: false, follow: false }, // 학교 내부용 — 검색엔진 노출 방지
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
