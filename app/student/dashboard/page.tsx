import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { MathText } from "@/components/MathText";
import { formatKstDate, formatKstDateTime } from "@/lib/datetime";

const STATUS_LABEL: Record<string, string> = { draft: "준비중", open: "진행중", closed: "마감" };

export default async function StudentDashboardPage() {
  const session = await requireRole("student");
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, subject, due_at, status, classes(name)")
    .order("created_at", { ascending: false })
    .overrideTypes<
      Array<{
        id: string;
        title: string;
        subject: string | null;
        due_at: string | null;
        status: string;
        classes: { name: string } | null;
      }>,
      { merge: false }
    >();

  const { data: submissions } = await supabase
    .from("submissions")
    .select("assignment_id, submitted_at")
    .eq("student_id", session.userId);

  const submittedMap = new Map((submissions ?? []).map((s) => [s.assignment_id, s.submitted_at]));

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("class_id, classes(name)")
    .eq("student_id", session.userId)
    .overrideTypes<Array<{ class_id: string; classes: { name: string } | null }>, { merge: false }>();

  const classNameById = new Map((enrollments ?? []).map((e) => [e.class_id, e.classes?.name ?? "클래스"]));

  // 등록된 클래스의 공지 (RLS: is_enrolled_in_class로 본인 클래스만 조회됨)
  const { data: announcements } = await supabase
    .from("class_announcements")
    .select("id, class_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // 현재 복습이 필요한(가장 최근 시도가 오답인) 개념들 — 개념별로 하나씩 카드로 보여준다.
  const { data: reviews } = await supabase
    .from("quiz_concept_reviews")
    .select("class_id, unit, keyword, explanation, created_at")
    .eq("student_id", session.userId)
    .order("created_at", { ascending: false });

  // 선생님이 남긴 학생별 종합 피드백 (RLS: 본인 것만)
  const { data: overallFeedback } = await supabase
    .from("quiz_student_feedback")
    .select("class_id, feedback, updated_at")
    .eq("student_id", session.userId)
    .order("updated_at", { ascending: false });

  // 선생님이 남긴 코멘트가 있는 풀이 (문항 내용도 함께)
  const { data: teacherNotes } = await supabase
    .from("quiz_attempts")
    .select("id, teacher_feedback, created_at, class_id, quiz_questions(content, unit)")
    .eq("student_id", session.userId)
    .not("teacher_feedback", "is", null)
    .order("created_at", { ascending: false })
    .overrideTypes<
      Array<{
        id: string;
        teacher_feedback: string;
        created_at: string;
        class_id: string;
        quiz_questions: { content: string; unit: string } | null;
      }>,
      { merge: false }
    >();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 과제</h1>
        <Link
          href="/student/join"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + 클래스 참여
        </Link>
      </div>

      {announcements && announcements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">공지</h2>
          <ul className="space-y-2">
            {announcements.map((n) => (
              <li key={n.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">{classNameById.get(n.class_id) ?? "클래스"}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-emerald-900">{n.body}</p>
                <p className="mt-1 text-xs text-emerald-600">{formatKstDateTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enrollments && enrollments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">문제 풀기</h2>
          <div className="flex flex-wrap gap-2">
            {enrollments.map((e) => (
              <Link
                key={e.class_id}
                href={`/student/quiz/${e.class_id}`}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                {e.classes?.name ?? "클래스"}
              </Link>
            ))}
          </div>
        </section>
      )}

      {reviews && reviews.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">복습이 필요한 개념</h2>
          <p className="text-xs text-gray-500">
            틀린 문항의 개념이에요. 아래 설명으로 복습한 뒤 다시 도전하면 아직 맞히지 못한 문항에 재도전할 수 있어요.
          </p>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div
                key={`${r.class_id}-${r.unit}-${r.keyword}`}
                className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    {r.keyword}
                  </span>
                  <span className="text-xs text-amber-700">
                    {classNameById.get(r.class_id) ?? "클래스"} · {r.unit}
                  </span>
                </div>
                <MathText text={r.explanation} className="block whitespace-pre-wrap text-sm text-amber-900" />
              </div>
            ))}
          </div>
        </section>
      )}

      {overallFeedback && overallFeedback.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">선생님 종합 피드백</h2>
          <div className="space-y-2">
            {overallFeedback.map((f) => (
              <div key={f.class_id} className="space-y-1 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs text-indigo-700">{classNameById.get(f.class_id) ?? "클래스"}</p>
                <MathText text={f.feedback} className="block whitespace-pre-wrap text-sm text-indigo-900" />
              </div>
            ))}
          </div>
        </section>
      )}

      {teacherNotes && teacherNotes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">문항별 선생님 피드백</h2>
          <div className="space-y-2">
            {teacherNotes.map((n) => (
              <div key={n.id} className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs text-blue-700">
                  {classNameById.get(n.class_id) ?? "클래스"}
                  {n.quiz_questions?.unit ? ` · ${n.quiz_questions.unit}` : ""}
                </p>
                {n.quiz_questions?.content && (
                  <MathText
                    text={n.quiz_questions.content.replace(/\n/g, " ").slice(0, 100)}
                    className="block truncate text-xs text-blue-800"
                  />
                )}
                <MathText text={n.teacher_feedback} className="block whitespace-pre-wrap text-sm text-blue-900" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!assignments || assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 참여한 클래스가 없습니다. 선생님께 받은 참여 코드로 클래스에 참여해보세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {assignments.map((a) => {
            const submitted = submittedMap.has(a.id);
            const className = a.classes?.name;
            return (
              <li key={a.id}>
                <Link href={`/student/assignments/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      {className}
                      {a.subject ? ` · ${a.subject}` : ""}
                      {a.due_at ? ` · 마감 ${formatKstDate(a.due_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        submitted ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {submitted ? "제출완료" : "미제출"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
