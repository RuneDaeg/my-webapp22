import { getGeminiClient, GEMINI_MODEL } from "./client";
import { GradingError } from "./grade";
import type { ClassStats } from "@/lib/quiz/classStats";

async function callGeminiText(prompt: string): Promise<string> {
  const ai = getGeminiClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ text: prompt }],
        // 짧은 피드백/개념 설명 생성은 추론이 필요 없다. 기본 thinking 모드를 끄지 않으면
        // 호출당 수십 초씩 걸려 answer 라우트에서 두 번 호출 시 함수 제한(60초)을 넘겨 504가 난다.
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const text = response.text?.trim();
      if (!text) throw new GradingError("Gemini 응답이 비어 있습니다.");
      return text;
    } catch (err) {
      lastError = err;
      const isRateLimit = err instanceof Error && /429|rate/i.test(err.message);
      if (!isRateLimit || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new GradingError("Gemini 호출에 실패했습니다.");
}

interface MultipleChoiceFeedbackInput {
  questionContent: string;
  options: string[];
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
}

// 모든 학생용 텍스트에 공통으로 붙이는 서식 규칙.
const STUDENT_TEXT_RULES = `[작성 규칙]
- 한국어로 작성하되, "안녕", "얘들아" 같은 인사말이나 격려·감탄사, 학생을 부르는 호칭을 쓰지 마세요.
- 대화체("~해요", "~네요", "~어요")를 쓰지 말고, "~이다 / ~한다 / ~된다" 같은 평서형 문어체로 개념 설명에만 집중하세요.
- 마크다운 서식(**굵게**, ##제목, - 목록 등)을 절대 쓰지 말고 일반 문장으로 쓰세요.
- 수식·기호는 $...$ 안에 LaTeX로 쓰세요 (예: $a = \\frac{F}{m}$).`;

export async function generateMultipleChoiceFeedback(input: MultipleChoiceFeedbackInput): Promise<string> {
  const common = `[문제]
${input.questionContent}

[보기]
${input.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

[정답] ${input.correctAnswer}
[학생 선택] ${input.studentAnswer}`;

  const prompt = input.isCorrect
    ? `당신은 학생의 객관식 문제 풀이를 돕는 AI 튜터입니다. 학생이 정답을 맞혔습니다.

${common}

왜 그 선택이 맞는지, 어떤 개념·원리가 적용됐는지 3~4문장으로 설명하며 이해를 다져주세요.
가능하면 비슷한 문제에서 주의할 점도 한 가지 곁들여 주세요.
${STUDENT_TEXT_RULES}`
    : `당신은 학생의 객관식 문제 풀이를 돕는 AI 튜터입니다. 학생이 오답을 선택했습니다.

${common}

학생이 스스로 복습하고 다시 풀어볼 수 있도록 안내하는 것이 목표입니다. 다음을 지키세요:
- 관련된 핵심 개념·원리를 3~4문장으로 자세히 설명하세요.
- 학생이 고른 답에서 어떤 오해나 계산 실수가 있었을지 추정해 짚어주세요.
- 다시 생각해볼 방향이나 확인해야 할 점을 힌트로 제시하세요.
- [매우 중요] 정답이 몇 번인지, 어느 보기가 맞는지, 또는 최종 정답 값을 절대 직접 알려주지 마세요.
  학생이 힌트를 바탕으로 스스로 다시 풀 수 있게만 안내하세요.
${STUDENT_TEXT_RULES}`;

  return callGeminiText(prompt);
}

export async function generateConceptExplanation(unit: string, keyword: string): Promise<string> {
  const prompt = `단원 "${unit}"에서 "${keyword}" 개념을 고등학생이 이해하기 쉽게 설명해주세요.
핵심 원리와 왜 중요한지, 자주 하는 실수를 포함해 3~4문장으로 작성하세요.
${STUDENT_TEXT_RULES}`;

  return callGeminiText(prompt);
}

// 교사용: 클래스 전체의 개념별·유형별 통과율을 바탕으로 약점을 분석한다.
export async function generateClassAnalysis(className: string, stats: ClassStats): Promise<string> {
  const fmt = (bs: ClassStats["concepts"]) =>
    bs.map((b) => `- ${b.label}: 통과율 ${b.rate}% (${b.correct}/${b.total})`).join("\n") || "- (데이터 없음)";

  const prompt = `당신은 학급의 학습 데이터를 분석하는 교육 전문가입니다.
"${className}" 클래스 학생 ${stats.studentCount}명의 문제 풀이 ${stats.totalAttempts}건을 집계한 결과이다.

[개념별 통과율 (낮은 순)]
${fmt(stats.concepts)}

[문항 유형별 통과율]
${fmt(stats.types)}

[난이도별 통과율]
${fmt(stats.difficulties)}

위 데이터를 근거로 교사에게 도움이 될 분석을 작성하세요:
- 학생들이 특히 어려워하는 개념과 문항 유형을 통과율 수치를 근거로 짚는다.
- 그 원인으로 추정되는 것(선행 개념 부족, 계산 과정, 유형 적응 등)을 제시한다.
- 다음 수업에서 보완하면 좋을 지도 방향을 2~3가지 제안한다.
- 표본(풀이 수)이 적은 항목은 신뢰도가 낮다는 점도 언급한다.

[작성 규칙]
- "~이다 / ~한다" 평서형 문어체로, 6~8문장 내외.
- 마크다운 서식(**, ## 등) 없이 일반 문장으로. 수식은 $...$ 안에 LaTeX로.`;

  return callGeminiText(prompt);
}
