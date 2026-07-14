import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { GradingResultPanel } from "@/components/GradingResultPanel";
import { SignedFileLink } from "@/components/SignedFileLink";
import type { GradingResult } from "@/lib/types/db";
import { formatKstDateTime } from "@/lib/datetime";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  await requireRole("teacher");
  const { id, submissionId } = await params;
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, original_filename, submitted_at, extracted_text, extraction_status, profiles(display_name), assignments(scoring_type), grading_results(*)",
    )
    .eq("id", submissionId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        original_filename: string;
        submitted_at: string;
        extracted_text: string | null;
        extraction_status: string;
        profiles: { display_name: string } | null;
        assignments: { scoring_type: "numeric" | "label" } | null;
        grading_results: GradingResult | null;
      },
      { merge: false }
    >();

  if (!submission) notFound();

  const assignment = submission.assignments;
  const student = submission.profiles;
  const gradingResult = submission.grading_results;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teacher/assignments/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← 과제로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{student?.display_name?.trim() || "(이름 없음)"}의 제출물</h1>
        <p className="mt-1 text-sm text-gray-500">
          {submission.original_filename} · 제출 {formatKstDateTime(submission.submitted_at)}
        </p>
        <div className="mt-2">
          <SignedFileLink submissionId={submission.id} label="원본 파일 다운로드" />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">추출된 제출 내용</h2>
        {submission.extraction_status === "ok" && submission.extracted_text ? (
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {submission.extracted_text}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            텍스트 추출에 실패했거나 아직 처리되지 않았습니다.
          </p>
        )}
      </section>

      <GradingResultPanel
        submissionId={submission.id}
        scoringType={assignment?.scoring_type ?? "label"}
        initialResult={gradingResult}
      />
    </div>
  );
}
