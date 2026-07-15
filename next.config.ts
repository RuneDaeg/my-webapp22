import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy — 이 앱이 실제로 필요한 것만 허용한다.
// - script: Next.js가 인라인 부트스트랩 스크립트를 쓰므로 'unsafe-inline' 필요.
//           'wasm-unsafe-eval'은 pdf.js(문항 그림 크롭)가 WebAssembly를 쓰기 때문.
//           개발 모드에서는 React Fast Refresh 때문에 'unsafe-eval'도 필요.
// - style : Tailwind/KaTeX 인라인 스타일 때문에 'unsafe-inline' 필요.
// - img   : Supabase Storage signed URL(문항 그림) + 크롭 미리보기(blob:) + data:
// - connect: Supabase REST/Auth/Realtime
// - worker: pdf.js 워커가 blob: 으로 로드됨
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'", // 클릭재킹 방지 (X-Frame-Options의 최신 대체재)
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // 구형 브라우저용 클릭재킹 방지
  { key: "X-Content-Type-Options", value: "nosniff" }, // MIME 스니핑 방지
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // 외부로 URL 경로 유출 방지
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HTTPS 강제 (Vercel은 HTTPS로 서빙됨)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb", // 채점기준/제출물 파일(최대 20MB) 업로드를 위해 기본 1MB에서 상향
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
