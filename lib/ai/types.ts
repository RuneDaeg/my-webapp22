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
