import { getGeminiClient, GEMINI_MODEL } from "./client";
import { buildGradingPrompt, buildGradingPromptForPdf } from "./prompt";
import { gradingResponseSchema, gradingResultSchema, type GradingResultPayload } from "./schema";

export class GradingError extends Error {}

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

interface GradeSubmissionBase {
  subject: string | null;
  assignmentTitle: string;
  scoringType: "numeric" | "label";
  criteriaText: string;
}

interface GradeSubmissionTextInput extends GradeSubmissionBase {
  submissionText: string;
}

interface GradeSubmissionPdfInput extends GradeSubmissionBase {
  pdfBuffer: Buffer;
}

export interface GradeSubmissionResult {
  payload: GradingResultPayload;
  rawResponse: unknown;
  modelName: string;
}

async function callGemini(parts: GeminiPart[]): Promise<unknown> {
  const ai = getGeminiClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: gradingResponseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new GradingError("Gemini 응답이 비어 있습니다.");
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      const isRateLimit = err instanceof Error && /429|rate/i.test(err.message);
      if (!isRateLimit || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new GradingError("Gemini 호출에 실패했습니다.");
}

export async function gradeSubmission(
  input: GradeSubmissionTextInput | GradeSubmissionPdfInput,
): Promise<GradeSubmissionResult> {
  const parts: GeminiPart[] =
    "pdfBuffer" in input
      ? [
          { inlineData: { data: input.pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
          { text: buildGradingPromptForPdf(input) },
        ]
      : [{ text: buildGradingPrompt(input) }];

  let raw = await callGemini(parts);
  let parsed = gradingResultSchema.safeParse(raw);

  if (!parsed.success) {
    // 스키마 불일치 시 한 번 더 엄격한 지시와 함께 재시도
    const retryParts: GeminiPart[] = [
      ...parts,
      {
        text: "[중요] 이전 응답이 요구된 JSON 스키마와 맞지 않았습니다. score, score_label, feedback, septeuk 필드를 정확히 채워 다시 응답하세요.",
      },
    ];
    raw = await callGemini(retryParts);
    parsed = gradingResultSchema.safeParse(raw);
  }

  if (!parsed.success) {
    throw new GradingError(`Gemini 응답이 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return { payload: parsed.data, rawResponse: raw, modelName: GEMINI_MODEL };
}
