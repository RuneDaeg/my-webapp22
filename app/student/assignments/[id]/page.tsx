import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { SubmissionUploadWidget } from "@/components/SubmissionUploadWidget";
import { formatKstDate, formatKstDateTime } from "@/lib/datetime";

export default async function StudentAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("student");
  const { id } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, subject, description, due_at, status")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  const [{ data: criteria }, { data: submission }, { data: result }] = await Promise.all([
    supabase.from("grading_criteria").select("criteria_text").eq("assignment_id", id).maybeSingle(),
    supabase
      .from("submissions")
      .select("id, original_filename, submitted_at")
      .eq("assignment_id", id)
      .eq("student_id", session.userId)
      .maybeSingle(),
    supabase.from("student_grading_results").select("*").eq("assignment_id", id).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {assignment.subject ? `${assignment.subject} · ` : ""}
          {assignment.due_at ? `마감 ${formatKstDate(assignment.due_at)}` : "마감일 없음"}
        </p>
        {assignment.description && <p className="mt-3 text-sm text-gray-700">{assignment.description}</p>}
      </div>

      {criteria?.criteria_text && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">채점 기준</h2>
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {criteria.criteria_text}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">과제 제출</h2>
        {assignment.status === "open" ? (
          <SubmissionUploadWidget assignmentId={assignment.id} currentFilename={submission?.original_filename ?? null} />
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            {submission
              ? `제출 완료 (${submission.original_filename}) · 제출 기간이 종료되어 더 이상 수정할 수 없습니다.`
              : "제출 기간이 종료되었습니다."}
          </p>
        )}
        {submission && (
          <p className="text-xs text-gray-400">제출 시각: {formatKstDateTime(submission.submitted_at)}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">채점 결과</h2>
        {result ? (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-700">
              점수:{" "}
              <span className="font-semibold text-gray-900">{result.score ?? result.score_label ?? "-"}</span>
            </p>
            {result.feedback && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">피드백</p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{result.feedback}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            아직 공개된 채점 결과가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
