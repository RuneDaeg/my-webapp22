import { runJson, withBackoff } from "@/lib/ai";
import type { AiCredential, AiPart } from "@/lib/ai/types";
import { buildGradingPrompt, buildGradingPromptForPdf } from "./prompt";
import { gradingResponseSchema, gradingResultSchema, type GradingResultPayload } from "./schema";

export class GradingError extends Error {}

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

export async function gradeSubmission(
  cred: AiCredential,
  input: GradeSubmissionTextInput | GradeSubmissionPdfInput,
): Promise<GradeSubmissionResult> {
  const parts: AiPart[] =
    "pdfBuffer" in input
      ? [{ pdfBase64: input.pdfBuffer.toString("base64") }, { text: buildGradingPromptForPdf(input) }]
      : [{ text: buildGradingPrompt(input) }];

  const call = (extra?: string) =>
    withBackoff(() =>
      runJson(cred, {
        parts: extra ? [...parts, { text: extra }] : parts,
        geminiSchema: gradingResponseSchema,
      }),
    );

  let raw = await call();
  let parsed = gradingResultSchema.safeParse(raw);

  if (!parsed.success) {
    // 스키마 불일치 시 한 번 더 엄격한 지시와 함께 재시도
    raw = await call(
      "[중요] 이전 응답이 요구된 JSON 스키마와 맞지 않았습니다. score, score_label, feedback, septeuk, rationale 필드를 정확히 채워 다시 응답하세요.",
    );
    parsed = gradingResultSchema.safeParse(raw);
  }

  if (!parsed.success) {
    throw new GradingError(`AI 응답이 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return { payload: parsed.data, rawResponse: raw, modelName: cred.model };
}
