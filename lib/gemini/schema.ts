import { Type, type Schema } from "@google/genai";
import { z } from "zod";

// Gemini 구조화 출력(responseSchema) 설정 — 모델이 이 스키마를 따르는 JSON만 반환하도록 강제한다.
export const gradingResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      nullable: true,
      description: "숫자 채점 방식일 때의 점수. 정성 평가면 null.",
    },
    score_label: {
      type: Type.STRING,
      nullable: true,
      description: "정성 평가 라벨(예: 상/중/하). 숫자 채점이면 null.",
    },
    feedback: {
      type: Type.STRING,
      description: "학생에게 보여줄 구체적이고 건설적인 피드백 (한국어).",
    },
    septeuk: {
      type: Type.STRING,
      description:
        "'과목별 세부능력 및 특기사항' 초안. 3인칭 관찰형 서술체(예: '~함', '~을 보여줌'), 인칭대명사 미사용.",
    },
    rationale: {
      type: Type.STRING,
      description:
        "채점 근거 (교사 전용, 학생에게는 노출되지 않음). 채점 기준의 각 항목/배점을 어떻게 적용했는지, 제출물의 어떤 부분을 근거로 몇 점을 주거나 뺐는지 구체적으로 설명.",
    },
  },
  required: ["feedback", "septeuk", "rationale"],
};

// Gemini 응답을 파싱한 뒤 애플리케이션 레벨에서 한 번 더 검증한다.
export const gradingResultSchema = z.object({
  score: z.number().nullable().optional(),
  score_label: z.string().nullable().optional(),
  feedback: z.string().min(1),
  septeuk: z.string().min(1),
  rationale: z.string().min(1),
});

export type GradingResultPayload = z.infer<typeof gradingResultSchema>;
