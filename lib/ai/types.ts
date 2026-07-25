import type { Schema } from "@google/genai";

export type AiProvider = "gemini" | "openai" | "anthropic";

export interface AiCredential {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

// 입력 파트: 텍스트 또는 PDF(base64). 각 제공사 어댑터가 자기 형식으로 변환한다.
export type AiPart = { text: string } | { pdfBase64: string };

export interface RunOptions {
  system?: string;
  parts: AiPart[];
  maxOutputTokens?: number;
  thinkingBudget?: number; // Gemini 전용 (다른 제공사는 무시)
  geminiSchema?: Schema; // Gemini JSON 응답 스키마 (다른 제공사는 프롬프트로 JSON 유도)
}

export class AiError extends Error {}

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
};

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
};

export const KEY_HINT: Record<AiProvider, string> = {
  gemini: "AIza… (Google AI Studio에서 발급)",
  openai: "sk-… (OpenAI platform에서 발급)",
  anthropic: "sk-ant-… (Anthropic console에서 발급)",
};

// 키가 유출되더라도 피해 상한을 교사가 직접 걸 수 있도록 제공사 콘솔의 한도 설정 위치를 안내한다.
// (서버 운영자는 기술적으로 복호화가 가능하다는 구조적 한계에 대한 실질적 완화책)
export const BUDGET_HINT: Record<AiProvider, { path: string; url: string }> = {
  gemini: {
    path: "Google Cloud 콘솔 → 결제 → 예산 및 알림",
    url: "https://console.cloud.google.com/billing",
  },
  openai: {
    path: "OpenAI platform → Settings → Limits",
    url: "https://platform.openai.com/settings/organization/limits",
  },
  anthropic: {
    path: "Anthropic Console → Settings → Limits",
    url: "https://console.anthropic.com/settings/limits",
  },
};
