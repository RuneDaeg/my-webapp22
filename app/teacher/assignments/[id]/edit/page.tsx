import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { updateAssignmentAction } from "@/app/teacher/actions";

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: assignment }, { data: criteria }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, subject, description, due_at, status, scoring_type")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("grading_criteria").select("criteria_text").eq("assignment_id", id).maybeSingle(),
  ]);

  if (!assignment) notFound();

  const dueAtValue = assignment.due_at ? assignment.due_at.slice(0, 10) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">과제 수정</h1>

      <form
        action={updateAssignmentAction}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="assignmentId" value={assignment.id} />

        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium text-gray-700">
            과제 제목
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={assignment.title}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="subject" className="text-sm font-medium text-gray-700">
              과목
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              defaultValue={assignment.subject ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="dueAt" className="text-sm font-medium text-gray-700">
              마감일
            </label>
            <input
              id="dueAt"
              name="dueAt"
              type="date"
              defaultValue={dueAtValue}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium text-gray-700">
            과제 설명 (학생에게 표시됨)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={assignment.description ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-700">채점 방식</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scoringType"
                  value="label"
                  defaultChecked={assignment.scoring_type === "label"}
                />{" "}
                정성 평가
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scoringType"
                  value="numeric"
                  defaultChecked={assignment.scoring_type === "numeric"}
                />{" "}
                숫자 점수
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium text-gray-700">
              상태
            </label>
            <select
              id="status"
              name="status"
              defaultValue={assignment.status}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              <option value="draft">임시저장 (학생에게 안 보임)</option>
              <option value="open">진행중 (제출 받는 중)</option>
              <option value="closed">마감 (제출 종료)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="criteriaText" className="text-sm font-medium text-gray-700">
            채점 기준
          </label>
          <textarea
            id="criteriaText"
            name="criteriaText"
            rows={10}
            required
            defaultValue={criteria?.criteria_text ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
