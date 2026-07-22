import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectNextQuestion, clampDifficulty } from "@/lib/quiz/adaptive";
import { attachImageUrl } from "@/lib/quiz/image";
import { gradeSubjectiveAnswer } from "@/lib/gemini/quizGrading";
import { generateMultipleChoiceFeedback, generateConceptExplanation } from "@/lib/gemini/quizFeedback";
import { GradingError } from "@/lib/gemini/grade";
import { getTeacherCredential, MissingCredentialError } from "@/lib/ai/credential";
import type { StudentQuizQuestion } from "@/lib/types/db";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnswerBody {
  questionId: string;
  submittedAnswer: string;
  currentDifficulty: number;
  attemptedIds?: string[]; // 이번 회차에 이미 푼 문항들 (현재 문항 포함) — 다음 문항 선정에서 제외
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "student") {
    return NextResponse.json({ error: "학생만 문제를 풀 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as AnswerBody | null;
  if (!body?.questionId || typeof body.submittedAnswer !== "string" || !body.submittedAnswer.trim()) {
    return NextResponse.json({ error: "답안을 입력해주세요." }, { status: 400 });
  }

  const supabase = await createClient();

  // 뷰가 published + 본인 등록 클래스로 제한한다 (정답은 포함되지 않음 = 접근 권한 검증도 겸함)
  const { data: question } = await supabase
    .from("student_quiz_questions")
    .select("*")
    .eq("id", body.questionId)
    .maybeSingle<StudentQuizQuestion>();

  if (!question) {
    return NextResponse.json({ error: "문제를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  // [보안] 정답은 채점에만 쓰이며 절대 응답에 담기지 않는다. 위에서 접근 권한이 검증된 문항에 한해
  // service-role로 정답만 서버에서 읽는다 (학생 세션으로는 정답을 읽을 수 없음).
  const { data: answerRow } = await createAdminClient()
    .from("quiz_questions")
    .select("answer, teacher_id")
    .eq("id", question.id)
    .maybeSingle();
  const correctAnswer = answerRow?.answer ?? "";

  // 채점·피드백은 이 문제를 만든 교사의 AI 키로 수행한다(키 필수 정책). 학생에게는 교사에게 문의하라고 안내.
  let cred;
  try {
    cred = await getTeacherCredential(answerRow?.teacher_id ?? "");
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      return NextResponse.json(
        { error: "담당 선생님이 AI API 키를 설정하지 않아 채점할 수 없습니다. 선생님께 문의해주세요." },
        { status: 503 },
      );
    }
    throw err;
  }

  const currentDifficulty = clampDifficulty(Number(body.currentDifficulty) || question.difficulty);

  let isCorrect: boolean;
  let feedback: string;

  try {
    if (question.type === "multiple") {
      isCorrect = body.submittedAnswer.trim() === correctAnswer.trim();
      feedback = await generateMultipleChoiceFeedback(cred, {
        questionContent: question.content,
        options: question.options ?? [],
        correctAnswer,
        studentAnswer: body.submittedAnswer,
        isCorrect,
      });
    } else {
      const graded = await gradeSubjectiveAnswer(cred, {
        unit: question.unit,
        questionContent: question.content,
        modelAnswer: correctAnswer,
        studentAnswer: body.submittedAnswer,
      });
      isCorrect = graded.is_correct;
      feedback = graded.feedback;
    }
  } catch (err) {
    const message = err instanceof GradingError ? err.message : "AI 채점 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 오답 개념 설명 캐시: 정답이면 캐시 삭제(다음에 또 틀리면 재생성), 오답이고 캐시가 없으면 1회 생성.
  let conceptExplanation: string | null = null;
  if (question.concept_keyword) {
    if (isCorrect) {
      await supabase
        .from("quiz_concept_reviews")
        .delete()
        .eq("student_id", session.userId)
        .eq("unit", question.unit)
        .eq("keyword", question.concept_keyword);
    } else {
      const { data: cached } = await supabase
        .from("quiz_concept_reviews")
        .select("explanation")
        .eq("student_id", session.userId)
        .eq("unit", question.unit)
        .eq("keyword", question.concept_keyword)
        .maybeSingle();

      if (cached) {
        conceptExplanation = cached.explanation;
      } else {
        try {
          conceptExplanation = await generateConceptExplanation(cred, question.unit, question.concept_keyword);
          await supabase.from("quiz_concept_reviews").insert({
            student_id: session.userId,
            class_id: question.class_id,
            unit: question.unit,
            keyword: question.concept_keyword,
            explanation: conceptExplanation,
          });
        } catch {
          conceptExplanation = null; // 개념 설명 생성 실패는 채점 자체를 막지 않는다
        }
      }
    }
  }

  const nextDifficulty = clampDifficulty(currentDifficulty + (isCorrect ? 1 : -1));

  // mastery 계산이 방금 이 시도를 반영하도록, 다음 문항을 고르기 전에 먼저 기록한다.
  await supabase.from("quiz_attempts").insert({
    question_id: question.id,
    student_id: session.userId,
    class_id: question.class_id,
    submitted_answer: body.submittedAnswer,
    is_correct: isCorrect,
    difficulty_at_attempt: currentDifficulty,
    ai_feedback: feedback,
  });

  // 이번 회차에 이미 푼 문항들(현재 문항 포함)을 제외한다.
  const attemptedIds = Array.from(new Set([...(body.attemptedIds ?? []), question.id]));

  const nextQuestion = await selectNextQuestion({
    supabase,
    classId: question.class_id,
    unit: question.unit,
    studentId: session.userId,
    targetDifficulty: nextDifficulty,
    attemptedIds,
    conceptKeyword: question.concept_keyword,
    wasWrong: !isCorrect,
  });

  return NextResponse.json({
    isCorrect,
    feedback,
    nextDifficulty,
    nextQuestion: await attachImageUrl(nextQuestion),
    conceptExplanation,
  });
}
