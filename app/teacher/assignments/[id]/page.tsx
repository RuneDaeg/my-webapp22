import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { setAssignmentStatusAction } from "@/app/teacher/actions";
import { formatKstDate, formatKstDateTime } from "@/lib/datetime";

const STATUS_LABEL: Record<string, string> = { draft: "임시저장", open: "진행중", closed: "마감" };

function gradingStatusLabel(status?: string, visible?: boolean): string {
  if (!status || status === "pending") return "미채점";
  if (status === "graded") return "AI 채점 완료 (검토 필요)";
  return visible ? "검토 완료 · 공개됨" : "검토 완료 · 비공개";
}

interface SubmissionRow {
  id: string;
  original_filename: string;
  submitted_at: string;
  extraction_status: string;
  profiles: { display_name: string } | null;
  grading_results: { status: string; visible_to_student: boolean } | null;
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, subject, description, due_at, status, class_id")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  const [{ data: criteria }, { data: submissions }] = await Promise.all([
    supabase.from("grading_criteria").select("criteria_text, source_type").eq("assignment_id", id).maybeSingle(),
    supabase
      .from("submissions")
      .select("id, original_filename, submitted_at, extraction_status, profiles(display_name), grading_results(status, visible_to_student)")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false }),
  ]);

  const rows = (submissions ?? []) as unknown as SubmissionRow[];
  const toggleStatus = assignment.status === "open" ? "closed" : "open";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {assignment.subject ? `${assignment.subject} · ` : ""}
            {STATUS_LABEL[assignment.status] ?? assignment.status}
            {assignment.due_at ? ` · 마감 ${formatKstDate(assignment.due_at)}` : ""}
          </p>
          {assignment.description && <p className="mt-3 max-w-2xl text-sm text-gray-700">{assignment.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/teacher/assignments/${assignment.id}/edit`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            수정
          </Link>
          <form action={setAssignmentStatusAction.bind(null, assignment.id, toggleStatus)}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {toggleStatus === "closed" ? "제출 마감하기" : "다시 열기"}
            </button>
          </form>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">채점 기준</h2>
        {criteria?.criteria_text ? (
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {criteria.criteria_text}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            등록된 채점 기준이 없습니다.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">제출물 ({rows.length}건)</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            아직 제출한 학생이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/assignments/${assignment.id}/submissions/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{s.profiles?.display_name ?? "(이름 없음)"}</p>
                    <p className="text-xs text-gray-500">
                      {s.original_filename} · {formatKstDateTime(s.submitted_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {gradingStatusLabel(s.grading_results?.status, s.grading_results?.visible_to_student)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
