import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { MathText } from "@/components/MathText";
import { TeacherFeedbackForm } from "@/components/TeacherFeedbackForm";
import { StudentOverallFeedbackForm } from "@/components/StudentOverallFeedbackForm";
import { formatKstDateTime } from "@/lib/datetime";

interface AttemptRow {
  id: string;
  submitted_answer: string | null;
  is_correct: boolean;
  ai_feedback: string | null;
  teacher_feedback: string | null;
  created_at: string;
  student_id: string;
  quiz_questions: { content: string; unit: string; concept_keyword: string | null } | null;
  profiles: { display_name: string } | null;
}

export default async function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: classRow } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!classRow) notFound();

  // RLS: is_teacher_of_class(class_id)로 본인 클래스 시도만 조회됨
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select(
      "id, submitted_answer, is_correct, ai_feedback, teacher_feedback, created_at, student_id, quiz_questions(content, unit, concept_keyword), profiles(display_name)",
    )
    .eq("class_id", id)
    .order("created_at", { ascending: false })
    .limit(1000)
    .overrideTypes<AttemptRow[], { merge: false }>();

  // 학생별 종합 피드백 (RLS: 교사 본인 클래스만 조회됨)
  const { data: overall } = await supabase
    .from("quiz_student_feedback")
    .select("student_id, feedback")
    .eq("class_id", id);
  const overallByStudent = new Map((overall ?? []).map((o) => [o.student_id, o.feedback]));

  // 학생별로 묶기 (조회가 최신순이므로 각 학생 안에서도 최신순 유지)
  const byStudent = new Map<string, { id: string; name: string; rows: AttemptRow[] }>();
  for (const a of attempts ?? []) {
    const entry =
      byStudent.get(a.student_id) ?? { id: a.student_id, name: a.profiles?.display_name?.trim() || "(이름 없음)", rows: [] };
    entry.rows.push(a);
    byStudent.set(a.student_id, entry);
  }

  const students = Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teacher/classes/${id}/quiz-bank`} className="text-sm text-gray-500 hover:text-gray-900">
          ← 문제은행으로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">학생 피드백 모아보기</h1>
        <p className="mt-1 text-sm text-gray-500">{classRow.name} · 학생이 문제를 풀며 받은 AI 피드백</p>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 학생이 푼 문제가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {students.map((s) => {
            const correct = s.rows.filter((r) => r.is_correct).length;
            return (
              <details key={s.name} className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-500">
                      {s.rows.length}문제 풀이 · 정답 {correct} / 오답 {s.rows.length - correct}
                    </span>
                  </div>
                </summary>
                <div className="border-t border-gray-100 bg-indigo-50/50 px-4 py-3">
                  <StudentOverallFeedbackForm
                    classId={id}
                    studentId={s.id}
                    initialFeedback={overallByStudent.get(s.id) ?? null}
                  />
                </div>
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {s.rows.map((r) => (
                    <li key={r.id} className="space-y-1 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            r.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {r.is_correct ? "정답" : "오답"}
                        </span>
                        <span>{r.quiz_questions?.unit}</span>
                        {r.quiz_questions?.concept_keyword ? <span>· {r.quiz_questions.concept_keyword}</span> : null}
                        <span className="ml-auto">{formatKstDateTime(r.created_at)}</span>
                      </div>
                      <MathText
                        text={(r.quiz_questions?.content ?? "").replace(/\n/g, " ").slice(0, 120)}
                        className="block truncate text-sm text-gray-700"
                      />
                      <p className="text-xs text-gray-500">학생 답안: {r.submitted_answer ?? "-"}</p>
                      {r.ai_feedback && (
                        <div className="rounded-md bg-gray-50 p-2">
                          <p className="mb-0.5 text-[10px] font-medium uppercase text-gray-400">AI 피드백</p>
                          <MathText text={r.ai_feedback} className="block whitespace-pre-wrap text-sm text-gray-800" />
                        </div>
                      )}
                      <div className="rounded-md border border-blue-100 bg-blue-50 p-2">
                        <TeacherFeedbackForm attemptId={r.id} classId={id} initialFeedback={r.teacher_feedback} />
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
