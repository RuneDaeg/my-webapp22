import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, type AiCredential, type AiPart, type RunOptions } from "./types";

// ============================================================
// 제공사-무관 통합 인터페이스
// ============================================================
// runText: 자유 텍스트 생성. runJson: JSON 하나를 파싱해 반환(스키마 검증은 호출부의 zod가 담당).
// 재시도는 호출부 래퍼가 관리한다(기존 동작 유지). 여기서는 1회 호출만 한다.

export async function runText(cred: AiCredential, opts: RunOptions): Promise<string> {
  switch (cred.provider) {
    case "gemini":
      return geminiText(cred, opts);
    case "openai":
      return openaiText(cred, opts);
    case "anthropic":
      return anthropicText(cred, opts);
  }
}

export async function runJson(cred: AiCredential, opts: RunOptions): Promise<unknown> {
  switch (cred.provider) {
    case "gemini":
      return geminiJson(cred, opts);
    case "openai":
      return openaiJson(cred, opts);
    case "anthropic":
      return anthropicJson(cred, opts);
  }
}

// 레이트리밋/과부하(429/529/overload) 시에만 짧게 재시도한다.
export async function withBackoff<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retriable = e instanceof Error && /429|rate|overload|529|timeout/i.test(e.message);
      if (!retriable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new AiError("AI 호출에 실패했습니다.");
}

function stripFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : t).trim();
}

function parseJson(raw: string): unknown {
  const text = stripFences(raw);
  if (!text) throw new AiError("AI 응답이 비어 있습니다.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("AI 응답이 유효한 JSON이 아닙니다(잘렸거나 형식 오류).");
  }
}

// ============================================================
// Gemini
// ============================================================
function geminiContents(parts: AiPart[]) {
  return parts.map((p) =>
    "text" in p ? { text: p.text } : { inlineData: { data: p.pdfBase64, mimeType: "application/pdf" } },
  );
}

async function geminiText(cred: AiCredential, opts: RunOptions): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: cred.apiKey });
  const parts = opts.system ? [{ text: opts.system }, ...geminiContents(opts.parts)] : geminiContents(opts.parts);
  const res = await ai.models.generateContent({
    model: cred.model,
    contents: parts,
    config: {
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
    },
  });
  return res.text?.trim() ?? "";
}

async function geminiJson(cred: AiCredential, opts: RunOptions): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey: cred.apiKey });
  const parts = opts.system ? [{ text: opts.system }, ...geminiContents(opts.parts)] : geminiContents(opts.parts);
  const res = await ai.models.generateContent({
    model: cred.model,
    contents: parts,
    config: {
      responseMimeType: "application/json",
      ...(opts.geminiSchema ? { responseSchema: opts.geminiSchema } : {}),
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
    },
  });
  return parseJson(res.text ?? "");
}

// ============================================================
// OpenAI (Responses API — PDF 입력 + 긴 출력 지원)
// ============================================================
function openaiContent(parts: AiPart[]) {
  return parts.map((p) =>
    "text" in p
      ? { type: "input_text" as const, text: p.text }
      : {
          type: "input_file" as const,
          filename: "document.pdf",
          file_data: `data:application/pdf;base64,${p.pdfBase64}`,
        },
  );
}

function openaiMaxTokens(opts: RunOptions): number | undefined {
  if (!opts.maxOutputTokens) return undefined;
  return Math.min(opts.maxOutputTokens, 16384); // gpt-4o 출력 한도에 맞춰 clamp
}

async function openaiText(cred: AiCredential, opts: RunOptions): Promise<string> {
  const client = new OpenAI({ apiKey: cred.apiKey });
  const res = await client.responses.create({
    model: cred.model,
    ...(opts.system ? { instructions: opts.system } : {}),
    input: [{ role: "user", content: openaiContent(opts.parts) }],
    ...(openaiMaxTokens(opts) ? { max_output_tokens: openaiMaxTokens(opts) } : {}),
  });
  return res.output_text?.trim() ?? "";
}

async function openaiJson(cred: AiCredential, opts: RunOptions): Promise<unknown> {
  const client = new OpenAI({ apiKey: cred.apiKey });
  const instructions =
    (opts.system ? opts.system + "\n\n" : "") + "반드시 유효한 JSON 하나만 출력하세요. 코드블록/설명 없이 JSON만.";
  const res = await client.responses.create({
    model: cred.model,
    instructions,
    input: [{ role: "user", content: openaiContent(opts.parts) }],
    ...(openaiMaxTokens(opts) ? { max_output_tokens: openaiMaxTokens(opts) } : {}),
  });
  return parseJson(res.output_text ?? "");
}

// ============================================================
// Anthropic Claude (document 블록으로 PDF 네이티브 지원)
// ============================================================
function anthropicContent(parts: AiPart[]): Anthropic.ContentBlockParam[] {
  return parts.map((p) =>
    "text" in p
      ? { type: "text", text: p.text }
      : { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdfBase64 } },
  );
}

function anthropicText_(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function anthropicText(cred: AiCredential, opts: RunOptions): Promise<string> {
  const client = new Anthropic({ apiKey: cred.apiKey });
  const msg = await client.messages.create({
    model: cred.model,
    max_tokens: Math.min(opts.maxOutputTokens ?? 4096, 8192),
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: anthropicContent(opts.parts) }],
  });
  return anthropicText_(msg);
}

async function anthropicJson(cred: AiCredential, opts: RunOptions): Promise<unknown> {
  const client = new Anthropic({ apiKey: cred.apiKey });
  const system =
    (opts.system ? opts.system + "\n\n" : "") + "반드시 유효한 JSON 하나만 출력하세요. 코드블록/설명 없이 JSON만.";
  const msg = await client.messages.create({
    model: cred.model,
    max_tokens: Math.min(opts.maxOutputTokens ?? 8192, 8192),
    system,
    messages: [{ role: "user", content: anthropicContent(opts.parts) }],
  });
  return parseJson(anthropicText_(msg));
}
