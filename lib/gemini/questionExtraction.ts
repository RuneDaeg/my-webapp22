import { runJson, withBackoff } from "@/lib/ai";
import type { AiCredential, AiPart } from "@/lib/ai/types";
import {
  questionExtractionResponseSchema,
  questionExtractionResultSchema,
  type QuestionExtractionItem,
} from "./questionExtractionSchema";
import { GradingError } from "./grade";

const INSTRUCTIONS = `당신은 한국 고등학교 문제지 PDF를 분석해 문항 단위로 데이터를 추출하는 AI입니다.

1. 문서에 있는 모든 문제를 하나씩 찾아 추출하세요. 지문/보기가 여러 문제에 걸쳐 공유되더라도 각 문제는
   독립된 항목으로 추출하고, content에는 그 문제를 푸는 데 필요한 지문 내용을 함께 포함하세요.
2. 보기(①②③④⑤ 등)가 있는 객관식 문제는 type을 "multiple"로, 서술형/단답형/논술형 문제는 "subjective"로
   분류하세요.
3. 객관식의 options는 번호(①, 1. 등)를 떼고 보기 텍스트만 담고, answer에는 정답 보기와 동일한 텍스트를
   그대로 넣으세요 (번호가 아니라 내용으로 매칭할 수 있도록).
4. 정답이 명시적으로 제공되지 않은 문제(정답지가 없는 경우)는 문제 내용과 보기를 근거로 가장 타당한
   정답을 판단해 채우되, 확신이 낮으면 concept_keyword에 그 사실을 반영하지 말고 answer만 최선으로 채우세요.
5. difficulty는 문제 난이도를 1(매우 쉬움)~5(매우 어려움)로 추정하세요. 정답률이 명시돼 있으면 참고하고,
   없으면 개념의 복잡도와 계산 단계 수로 판단하세요.
6. concept_keyword는 이 문제가 다루는 핵심 개념을 2~6글자 내외로 짧게 적으세요 (예: "뉴턴 제2법칙",
   "이온화 에너지"). 여러 개념이 섞여 있으면 가장 핵심적인 것 하나만 고르세요.
7. page는 문제가 시작되는 PDF 페이지 번호(1부터 시작)를 적으세요.
8. 정기시험 안내문, 답안지 양식, 채점 기준표 등 실제 문제가 아닌 부분은 제외하세요.
9. 수식·기호 표기: 수식, 아래첨자/위첨자, 그리스 문자, 분수, 근호 등은 반드시 $...$로 감싼 LaTeX로
   쓰세요. 예: $v_0$, $\\theta_2$, $\\frac{1}{2}mv^2$, $2\\,\\mathrm{m/s^2}$, $^{235}_{92}\\mathrm{U}$.
   일반 한글/영문 문장은 LaTeX로 감싸지 마세요. content, options, answer 모두 동일하게 적용됩니다.
   [매우 중요] JSON 문자열 안에서 LaTeX의 백슬래시(\\)는 반드시 이중 백슬래시(\\\\)로 이스케이프하세요.
   예: "$\\\\frac{1}{2}mv^2$", "$\\\\theta_1$". 그렇지 않으면 \\t, \\f 등이 제어문자로 잘못 해석됩니다.
   그림/표/자료에 대한 설명도 모두 한국어로 쓰세요 (영어 설명 금지).
10. content 줄바꿈: 읽기 좋게 줄바꿈 문자(\\n)로 구조를 나누세요.
   - 발문(질문 문장)과 그림/표/자료 설명은 서로 다른 줄에
   - "<보기>"는 새 줄에서 시작
   - <보기>의 각 항목(ㄱ., ㄴ., ㄷ. 등)도 각각 새 줄에
   - 실험 과정 (가), (나), (다)나 조건 나열도 각각 새 줄에

반드시 주어진 JSON 스키마 배열 형식으로만 응답하고, 그 외 설명이나 markdown은 출력하지 마세요.`;

// 문항이 많은 문제지는 출력이 길어져 기본 토큰 한도에서 JSON이 잘릴 수 있어 최대치로 늘린다.
// 기본 thinking 모드는 실제 문제지 PDF에서 6분 가까이 걸려 Vercel 함수 시간 제한을 초과하므로,
// 추출(옮겨 적기에 가까움)에는 thinking 예산을 제한해 응답 시간을 줄인다(Gemini 전용; 타 제공사는 무시).
async function callAi(cred: AiCredential, parts: AiPart[]): Promise<unknown> {
  return withBackoff(() =>
    runJson(cred, {
      parts,
      geminiSchema: questionExtractionResponseSchema,
      maxOutputTokens: 65536,
      thinkingBudget: 2048,
    }),
  );
}

// Gemini가 JSON 문자열 안의 LaTeX 백슬래시를 이스케이프하지 않으면 JSON.parse가 \t(탭), \f(폼피드),
// \b(백스페이스), \r, \n을 제어문자로 바꿔버려 \text → [탭]ext, \frac → [폼피드]rac처럼 깨진다.
// 수식($...$) 안에는 이런 제어문자가 들어갈 이유가 없으므로 원래의 LaTeX 명령으로 되돌린다.
function repairLatexControlChars(text: string): string {
  return text.replace(/\$[^$]*\$/g, (seg) =>
    seg
      .replace(/\t/g, "\\t")
      .replace(/\x08/g, "\\b")
      .replace(/\f/g, "\\f")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n"),
  );
}

function repairItem(item: QuestionExtractionItem): QuestionExtractionItem {
  return {
    ...item,
    content: repairLatexControlChars(item.content),
    options: item.options ? item.options.map(repairLatexControlChars) : item.options,
    answer: repairLatexControlChars(item.answer),
  };
}

export async function extractQuestionsFromPdf(
  cred: AiCredential,
  pdfBuffer: Buffer,
): Promise<QuestionExtractionItem[]> {
  const parts: AiPart[] = [{ pdfBase64: pdfBuffer.toString("base64") }, { text: INSTRUCTIONS }];

  // callAi가 던지는 에러(응답 잘림, 레이트리밋 소진 등)도 스키마 검증 실패와 동일하게
  // "더 엄격한 지시로 1회 재시도" 경로를 타도록 try/catch로 감싼다 — 그냥 await만 하면 여기서
  // 바로 throw되어 아래 재시도 로직이 전혀 실행되지 않는다 (실제로 실제 문제지 PDF로 재현된 버그).
  let raw: unknown;
  let parsed: ReturnType<typeof questionExtractionResultSchema.safeParse> | undefined;
  try {
    raw = await callAi(cred, parts);
    parsed = questionExtractionResultSchema.safeParse(raw);
  } catch {
    parsed = undefined;
  }

  if (!parsed || !parsed.success) {
    const retryParts: AiPart[] = [
      ...parts,
      {
        text: "[중요] 이전 응답이 잘렸거나 요구된 JSON 배열 스키마와 맞지 않았습니다. 각 항목에 type, content, answer, difficulty를 정확히 채워 배열로 다시 응답하세요. 문항 수가 많다면 일부 문항이라도 완전한 JSON으로 응답하세요.",
      },
    ];
    try {
      raw = await callAi(cred, retryParts);
      parsed = questionExtractionResultSchema.safeParse(raw);
    } catch (err) {
      throw err instanceof GradingError ? err : new GradingError("문항 추출 중 오류가 발생했습니다.");
    }
  }

  if (!parsed.success) {
    throw new GradingError(`문항 추출 결과가 예상한 형식과 다릅니다: ${parsed.error.message}`);
  }

  return parsed.data.map(repairItem);
}
