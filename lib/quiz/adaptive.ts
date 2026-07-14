import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QuizQuestion } from "@/lib/types/db";

type Client = SupabaseClient<Database>;

// student_id의 각 문항별 "가장 최근 시도"가 정답이면 그 문항은 마스터한 것으로 본다.
export async function getMasteredQuestionIds(
  supabase: Client,
  studentId: string,
  questionIds: string[],
): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("question_id, is_correct, created_at")
    .eq("student_id", studentId)
    .in("question_id", questionIds)
    .order("created_at", { ascending: true });

  const latestByQuestion = new Map<string, boolean>();
  for (const a of attempts ?? []) {
    latestByQuestion.set(a.question_id, a.is_correct); // 오래된 것부터 순회하며 덮어써 마지막 값이 최신 시도가 됨
  }

  const mastered = new Set<string>();
  for (const [questionId, isCorrect] of latestByQuestion) {
    if (isCorrect) mastered.add(questionId);
  }
  return mastered;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

interface SelectNextQuestionInput {
  supabase: Client;
  classId: string;
  unit: string;
  studentId: string;
  targetDifficulty: number;
  // 이번 회차에 이미 푼 문항 id들. 정오답 상관없이 이번 회차에는 다시 내지 않는다 —
  // 틀린 문항은 학생이 복습 후 "다시 도전"(새 회차)에서 재도전하게 한다.
  attemptedIds?: string[];
  conceptKeyword?: string | null;
  wasWrong?: boolean;
}

// 3단계 우선순위: (오답 시) 같은 개념 → 목표 난이도 일치 → 남은 문항 아무거나.
// 후보에서 (1) 이미 마스터한 문항과 (2) 이번 회차에 이미 푼 문항을 모두 제외한다.
export async function selectNextQuestion(input: SelectNextQuestionInput): Promise<QuizQuestion | null> {
  const { supabase, classId, unit, studentId, targetDifficulty, attemptedIds, conceptKeyword, wasWrong } = input;

  const { data: allQuestions } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("class_id", classId)
    .eq("unit", unit)
    .eq("status", "published");

  const pool = allQuestions ?? [];
  if (pool.length === 0) return null;

  const masteredIds = await getMasteredQuestionIds(
    supabase,
    studentId,
    pool.map((q) => q.id),
  );
  const attempted = new Set(attemptedIds ?? []);
  const candidates = pool.filter((q) => !masteredIds.has(q.id) && !attempted.has(q.id));
  if (candidates.length === 0) return null; // 이번 회차 종료 (남은 건 이미 풀었거나 마스터함)

  if (wasWrong && conceptKeyword) {
    const sameConcept = candidates.filter((q) => q.concept_keyword === conceptKeyword);
    const picked = pickRandom(sameConcept);
    if (picked) return picked;
  }

  const sameDifficulty = candidates.filter((q) => q.difficulty === targetDifficulty);
  const pickedByDifficulty = pickRandom(sameDifficulty);
  if (pickedByDifficulty) return pickedByDifficulty;

  return pickRandom(candidates);
}

export function clampDifficulty(value: number): number {
  return Math.min(5, Math.max(1, value));
}
