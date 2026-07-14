import { Type, type Schema } from "@google/genai";
import { z } from "zod";

// Gemini 구조화 출력 — 문제지 PDF에서 뽑아낸 문항 배열.
export const questionExtractionResponseSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        enum: ["multiple", "subjective"],
        description: "객관식이면 multiple, 서술형/단답형이면 subjective",
      },
      content: {
        type: Type.STRING,
        description: "문제 본문 (보기 번호는 options에 별도로 담고, content에는 문제 지문만)",
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        nullable: true,
        description: "객관식 보기 목록 (번호 없이 텍스트만). 서술형이면 null",
      },
      answer: {
        type: Type.STRING,
        description: "정답. 객관식이면 정답 보기의 내용(options 중 하나와 동일한 문자열), 서술형이면 모범답안",
      },
      difficulty: {
        type: Type.NUMBER,
        description: "난이도 추정치, 1(쉬움)~5(어려움) 중 하나",
      },
      concept_keyword: {
        type: Type.STRING,
        nullable: true,
        description: "이 문제가 다루는 핵심 개념 키워드 (짧게, 예: '뉴턴 제2법칙'). 판단하기 어려우면 null",
      },
      page: {
        type: Type.NUMBER,
        nullable: true,
        description: "문제가 위치한 PDF 페이지 번호(1부터 시작). 알 수 없으면 null",
      },
    },
    required: ["type", "content", "answer", "difficulty"],
  },
};

export const questionExtractionItemSchema = z.object({
  type: z.enum(["multiple", "subjective"]),
  content: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string().min(1),
  difficulty: z.number().min(1).max(5),
  concept_keyword: z.string().nullable().optional(),
  page: z.number().nullable().optional(),
});

export const questionExtractionResultSchema = z.array(questionExtractionItemSchema).min(1);

export type QuestionExtractionItem = z.infer<typeof questionExtractionItemSchema>;
