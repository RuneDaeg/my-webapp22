import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb", // 채점기준/제출물 파일(최대 20MB) 업로드를 위해 기본 1MB에서 상향
    },
  },
};

export default nextConfig;
