import { getGeminiClient, GEMINI_MODEL } from "./client";
import { quizGradingResponseSchema, quizGradingResultSchema, type QuizGradingResultPayload } from "./quizGradingSchema";
import { GradingError } from "./grade";

interface GradeSubjectiveAnswerInput {
  unit: string;
  questionContent: string;
  modelAnswer: string;
  studentAnswer: string;
}

async function callGemini(prompt: string): Promise<unknown> {
  const ai = getGeminiClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: quizGradingResponseSchema,
          // 기본 thinking 모드는 호출을 수십 초까지 늘려 함수 제한을 넘길 수 있다. 정오답 판단에
          // 필요한 만큼만 작은 예산을 준다 (0으로 완전히 끄면 애매한 답안 판정이 부정확해질 수 있음).
          thinkingConfig: { thinkingBudget: 512 },
        },
      });

      const text = response.text;
      if (!text) throw new GradingError("Gemini 응답이 비어 있습니다.");
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      const isRateLimit = err instanceof Error && /429|rate/i.test(err.message);
      if (!isRateLimit || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new GradingError("Gemini 호출에 실패했습니다.");
}

export async function gradeSubjectiveAnswer(
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

  let raw = await callGemini(prompt);
  let parsed = quizGradingResultSchema.safeParse(raw);

  if (!parsed.success) {
    raw = await callGemini(
      `${prompt}\n\n[중요] 이전 응답이 요구된 JSON 스키마와 맞지 않았습니다. is_correct, feedback 필드를 정확히 채워 다시 응답하세요.`,
    );
    parsed = quizGradingResultSchema.safeParse(raw);
  }

  if (!parsed.success) {
    throw new GradingError(`서술형 채점 결과가 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return parsed.data;
}
