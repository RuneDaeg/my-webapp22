import { getGeminiClient, GEMINI_MODEL } from "./client";
import {
  planExtractionResponseSchema,
  planExtractionResultSchema,
  type PlanExtractionItem,
} from "./planExtractionSchema";
import { GradingError } from "./grade";

const INSTRUCTIONS = `당신은 한국 초·중·고등학교 교사가 작성한 "교과 평가계획" 문서를 분석하는 AI입니다.
이 문서에는 보통 "Ⅱ 평가 운영 계획" 같은 섹션 아래에 "수행평가 과제별 세부 계획"처럼, 수행평가 활동마다
관련 성취기준·평가요소·배점·채점기준·평가방법·유의점이 정리된 부분이 있습니다 (정확한 제목은 문서마다
다를 수 있으니 내용을 보고 판단하세요 — 배점과 채점기준표가 딸린 수행평가 활동 목록을 찾으면 됩니다).

이 섹션을 찾아 수행평가 "제출 단위"로 목록을 뽑아주세요. 여기서 "제출 단위"란 학생이 실제로 하나의
결과물(파일 1개, 또는 한 번에 제출하는 결과물 묶음)로 내는 단위를 말합니다 — 채점 배점이 몇 개로
나뉘어 있는지가 아니라, **학생이 몇 번 따로 제출해야 하는지**가 분리 기준입니다.

1. 하나의 수행평가 항목 안에 배점이 여러 개로 나뉜 하위 요소들이 있을 때, 다음 두 경우를 구분하세요.
   - **합쳐서 1개 항목으로 유지**: 하위 요소들이 상위 활동명(또는 "보고서", "탐구 활동" 등 하나의
     결과물을 가리키는 표현) 아래 함께 묶여 있고, 배점을 모두 더하면 그 활동의 총점이 되는 경우
     (예: "OO 탐구 활동" 아래 "규칙성 찾기 40점 + 발전 과정 30점 + 과학의 본성 30점 = 100점"처럼
     하나의 보고서/결과물 안에서 여러 측면을 평가하는 구조). 이 경우 evaluation_elements와
     scoring_criteria에 하위 요소들을 번호를 매겨 모두 포함하되, 항목 자체는 1개로 유지하세요.
   - **별도 항목으로 분리**: 하위 요소들이 상위 활동명으로 묶이지 않고 독립된 이름의 개별 활동으로
     나란히 나열되어 있고, 서로 다른 결과물(예: "~제작해보기", "~만들어보기"처럼 각각 다른 물건/파일을
     만드는 활동)을 요구하는 경우 (예: "스피커 제작해보기 25점", "전자기 편지 제작해보기 25점",
     "간섭 그림 만들어보기 25점"처럼 각각 별개의 제작물). 이 경우 반드시 하위 활동마다 별도 항목으로
     분리하세요.
   - **배점이 합산되더라도 분리해야 하는 예외**: 상위 활동명 아래 배점이 합쳐져도, 하위 요소들이
     다음 중 하나라도 명확히 다르게 명시돼 있으면 별개의 제출로 보고 분리하세요.
     (a) 서로 다른 차시/시기에 수행한다고 적혀 있음 (예: "1차시: 개념 이해", "2~4차시: 보고서 작성")
     (b) 채점 방식/공식 자체가 다름 (예: 한쪽은 "취득 점수 합 ÷ 총점 × 25" 같은 환산식, 다른 쪽은
     단계별 배점표) — 채점 방식이 다르다는 건 보통 서로 다른 형태의 결과물(예: 지필/구술 확인 vs
     서술형 보고서)이라는 뜻입니다.
     (c) 하위 요소별로 평가 방법이나 AI 활용 유의점이 다르게 적용된다고 별도로 명시돼 있음
     이런 신호가 있으면 배점이 하나로 합산되어 있어도 반드시 분리하세요.
   - 그 외의 애매한 경우는 합치는 쪽(분리하지 않는 쪽)을 기본값으로 하세요 — 잘못 합쳐진 경우보다
     잘못 쪼개진 경우가 교사에게 더 번거롭습니다(제출을 여러 번 나눠 받아야 함).
2. 정기시험(지필고사), 총괄 성취기준 목록, 성취율-성취도 환산표 등 수행평가 활동 자체가 아닌 부분은
   제외하세요.
3. related_standards, evaluation_elements, scoring_criteria, evaluation_method, notes는 각각 이 활동
   하나에만 해당하는 내용만 담으세요 (다른 활동의 내용을 섞지 마세요). 원문에 가깝게 정리하되 읽기
   좋게 다듬으세요.
   - related_standards: 관련 교육과정 성취기준 (코드 포함). 성취기준이 여러 개면 한 줄에 하나씩 쓰세요.
   - evaluation_elements: 평가요소와 배점. 평가요소가 여러 개면 한 줄에 하나씩("- 요소명: 배점" 형태) 쓰세요.
   - scoring_criteria: 단계별 채점 기준 상세. [가독성을 위해 반드시 줄바꿈(\\n)으로 구조화하세요]
     · 채점 영역(평가요소)이 여러 개면 각 영역을 빈 줄로 구분하고, 각 영역의 첫 줄에 "[영역명] (배점)"을
       제목처럼 쓰세요.
     · 각 배점 단계(점수 구간)는 한 줄에 하나씩, "- " 로 시작해 쓰세요. 배점별 서술 내용은 원문 그대로
       유지하되 한 줄에 한 단계만 담습니다. 예:
         물리학 핵심 개념 이해 및 적용 (25점)
         - 취득 점수 합이 0점인 경우(기본 점수): 5점
         - 고의적 미응시: 0점

         주제 선정, 역학적 원리 추출 및 설명 (30점)
         - (1), (2), (3)을 모두 만족함: 30점
         - (1), (2), (4)를 모두 만족함: 27점
     · 마크다운 기호(**, ##, 표 문법 등)는 쓰지 말고 위처럼 일반 텍스트와 줄바꿈만 사용하세요.
   - evaluation_method: 평가 방법 (명시 안 돼있으면 null)
   - notes: 이 활동에 해당하는 유의점(AI 활용 유의점, 활동 유의사항 등). 없으면 null. 여러 개면 한 줄에 하나씩.
3-1. scoring_criteria 표 안에 "채점요소 ㉠~㉤를 모두 만족한 경우"처럼 하위 채점요소를 기호로 지칭하는
   문장이 있으면, 그 요약 문장만 옮기지 말고 각 기호가 실제로 가리키는 내용(정의)까지 반드시 함께
   빠짐없이 적으세요. 예: "채점요소: (1) 모둠활동 참여도, (2) 카드의 규칙성, (3) 카드의 분류 기준,
   (4) 잃어버린 카드의 모양, (5) 잃어버린 카드의 근거" 처럼 정의 목록을 먼저 쓰고, 그 다음에 배점별
   기준("(1)~(5)를 모두 만족한 경우: 40점" 등)을 쓰세요.
3-2. ㉠㉡㉢, ①②③, ⓐⓑⓒ 같은 원문자(동그라미 문자)는 서로 시각적으로 헷갈리기 쉬워 정확히 옮기지
   못할 위험이 있습니다. 이런 기호를 그대로 재현하려 하지 말고, 항상 "(1)", "(2)", "(3)"... 같은
   일반 숫자 표기로 바꿔서 일관되게 사용하세요 (원문 표에서 어떤 기호를 썼든 상관없이 동일하게 변환).
4. subject는 문서 상단(표지/헤더)에 적힌 과목명을 그대로 쓰세요. 찾을 수 없으면 null로 두세요.
5. scoring_type은 해당 활동에 숫자 배점 합계(예: 100점)가 있으면 "numeric", A~E 같은 등급만 있으면
   "label"로 표시하세요.

반드시 주어진 JSON 스키마 배열 형식으로만 응답하고, 그 외 설명이나 markdown은 출력하지 마세요.`;

async function callGemini(parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>) {
  const ai = getGeminiClient();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: planExtractionResponseSchema,
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

interface ExtractFromPdfInput {
  pdfBuffer: Buffer;
}

interface ExtractFromTextInput {
  planText: string;
}

export async function extractEvaluationPlan(
  input: ExtractFromPdfInput | ExtractFromTextInput,
): Promise<PlanExtractionItem[]> {
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> =
    "pdfBuffer" in input
      ? [{ inlineData: { data: input.pdfBuffer.toString("base64"), mimeType: "application/pdf" } }, { text: INSTRUCTIONS }]
      : [{ text: `${INSTRUCTIONS}\n\n[평가계획 문서 텍스트]\n${input.planText}` }];

  let raw = await callGemini(parts);
  let parsed = planExtractionResultSchema.safeParse(raw);

  if (!parsed.success) {
    const retryParts = [
      ...parts,
      {
        text: "[중요] 이전 응답이 요구된 JSON 배열 스키마와 맞지 않았습니다. 각 항목에 title, scoring_type, related_standards, evaluation_elements, scoring_criteria를 정확히 채워 배열로 다시 응답하세요.",
      },
    ];
    raw = await callGemini(retryParts);
    parsed = planExtractionResultSchema.safeParse(raw);
  }

  if (!parsed.success) {
    throw new GradingError(`평가계획 분석 결과가 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return parsed.data;
}
