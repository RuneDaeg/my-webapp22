import { runJson, withBackoff } from "@/lib/ai";
import type { AiCredential } from "@/lib/ai/types";
import { quizGradingResponseSchema, quizGradingResultSchema, type QuizGradingResultPayload } from "./quizGradingSchema";
import { GradingError } from "./grade";

interface GradeSubjectiveAnswerInput {
  unit: string;
  questionContent: string;
  modelAnswer: string;
  studentAnswer: string;
}

export async function gradeSubjectiveAnswer(
  cred: AiCredential,
  input: GradeSubjectiveAnswerInput,
): Promise<QuizGradingResultPayload> {
  const prompt = `당신은 학생의 서술형 답안을 채점하는 AI 튜터입니다. 단원: ${input.unit}

[문제]
${input.questionContent}

[모범답안]
${input.modelAnswer}

[학생 답안]
${input.studentAnswer}

먼저 정오답을 판단하세요. 학생 답안이 모범답안의 핵심 내용을 충분히 포함하면 정답으로 판단하고,
표현이 다르거나 부분적으로 다른 방식으로 서술해도 핵심 개념이 맞으면 정답으로 인정하세요. 오탈자나
사소한 표현 차이만으로 오답 처리하지 마세요.

그다음 feedback을 작성하세요:
- 정답이면: 잘한 점을 짚어주고 개념을 3~4문장으로 더 깊이 다져주세요.
- 오답이면: 관련 개념·원리를 3~4문장으로 자세히 설명하고, 학생 답안에서 부족하거나 빠진 부분이
  무엇인지 방향을 제시하세요. 단, 모범답안의 문장이나 결정적 정답 내용을 그대로 알려주지는 말고,
  학생이 스스로 보완해 다시 답할 수 있도록 힌트만 주세요.

[feedback 작성 규칙]
- 인사말·격려·호칭 없이 개념 설명에만 집중.
- 대화체가 아니라 "~이다 / ~한다" 평서형 문어체로.
- 마크다운 서식(**굵게**, ## 등)을 쓰지 말고 일반 문장으로.
- 수식은 $...$ 안에 LaTeX로.`;

  // 정오답 판단에 약간의 추론이 필요해 thinkingBudget 512 (Gemini 전용; 타 제공사는 무시).
  const call = (p: string) =>
    withBackoff(() => runJson(cred, { parts: [{ text: p }], geminiSchema: quizGradingResponseSchema, thinkingBudget: 512 }));

  let raw = await call(prompt);
  let parsed = quizGradingResultSchema.safeParse(raw);

  if (!parsed.success) {
    raw = await call(
      `${prompt}\n\n[중요] 이전 응답이 요구된 JSON 스키마와 맞지 않았습니다. is_correct, feedback 필드를 정확히 채워 다시 응답하세요.`,
    );
    parsed = quizGradingResultSchema.safeParse(raw);
  }

  if (!parsed.success) {
    throw new GradingError(`서술형 채점 결과가 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return parsed.data;
}
