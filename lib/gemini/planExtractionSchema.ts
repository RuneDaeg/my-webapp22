import { Type, type Schema } from "@google/genai";
import { z } from "zod";

// Gemini 구조화 출력(responseSchema) — 평가계획 문서에서 뽑아낸 수행평가 항목 배열.
// 관련 성취기준 / 평가요소·배점 / 채점기준 / 평가방법 / 유의점을 각각 별도 필드로 받아
// 검토 화면에서 항목별로 구분해서 보여주고 수정할 수 있게 한다.
export const planExtractionResponseSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "수행평가 활동명 (구체적으로, 예: '전류의 자기작용을 활용한 나만의 스피커 제작해보기')",
      },
      subject: {
        type: Type.STRING,
        nullable: true,
        description: "과목명 (문서 상단에서 추출, 예: '물리학')",
      },
      scoring_type: {
        type: Type.STRING,
        enum: ["numeric", "label"],
        description: "배점 합이 명시돼 있으면 numeric, 정성 등급(A/B/C 등)만 있으면 label",
      },
      related_standards: {
        type: Type.STRING,
        description: "이 활동과 관련된 교육과정 성취기준 (코드+내용, 예: '[12물리02-05] 전류의 자기 작용을...')",
      },
      evaluation_elements: {
        type: Type.STRING,
        description: "평가요소와 배점 (예: '전류의 자기작용을 활용한 나만의 스피커 제작해보기 (총 25점)')",
      },
      scoring_criteria: {
        type: Type.STRING,
        description:
          "단계별 채점 기준 상세. 줄바꿈(\\n)으로 구조화한다: 채점 영역이 여러 개면 영역마다 '[영역명] (배점)' 제목 줄을 두고 빈 줄로 구분하며, 각 배점 단계는 '- ...: N점'처럼 한 줄에 하나씩 쓴다. 마크다운 기호는 쓰지 않는다.",
      },
      evaluation_method: {
        type: Type.STRING,
        nullable: true,
        description: "평가 방법 (예: '서술·논술, 구술·발표, 실험·실습' 등). 명시돼 있지 않으면 null",
      },
      notes: {
        type: Type.STRING,
        nullable: true,
        description: "이 활동에 해당하는 유의점 (AI 활용 유의점, 활동 시 유의사항 등). 없으면 null",
      },
    },
    required: ["title", "scoring_type", "related_standards", "evaluation_elements", "scoring_criteria"],
  },
};

export const planExtractionItemSchema = z.object({
  title: z.string().min(1),
  subject: z.string().nullable().optional(),
  scoring_type: z.enum(["numeric", "label"]).default("numeric"),
  related_standards: z.string().min(1),
  evaluation_elements: z.string().min(1),
  scoring_criteria: z.string().min(1),
  evaluation_method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const planExtractionResultSchema = z.array(planExtractionItemSchema).min(1);

export type PlanExtractionItem = z.infer<typeof planExtractionItemSchema>;
