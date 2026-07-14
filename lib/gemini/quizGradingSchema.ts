import { Type, type Schema } from "@google/genai";
import { z } from "zod";

// Gemini 구조화 출력 — 서술형 문제 채점(정오답 판단 + 피드백).
export const quizGradingResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    is_correct: {
      type: Type.BOOLEAN,
      description: "학생 답안이 모범답안의 핵심 내용을 충분히 포함하면 true, 아니면 false.",
    },
    feedback: {
      type: Type.STRING,
      description: "학생에게 보여줄 짧고 구체적인 피드백 (정답이면 칭찬, 오답이면 어떤 부분이 부족한지, 한국어).",
    },
  },
  required: ["is_correct", "feedback"],
};

export const quizGradingResultSchema = z.object({
  is_correct: z.boolean(),
  feedback: z.string().min(1),
});

export type QuizGradingResultPayload = z.infer<typeof quizGradingResultSchema>;
