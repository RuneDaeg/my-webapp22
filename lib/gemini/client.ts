import { GoogleGenAI } from "@google/genai";

// 서버 전용 — GEMINI_API_KEY는 NEXT_PUBLIC_ 접두어를 절대 붙이지 않는다.
let cached: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!cached) {
    cached = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return cached;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
