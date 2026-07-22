import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText, ExtractionError } from "@/lib/extraction";
import { gradeSubmission, GradingError } from "@/lib/gemini/grade";
import { getTeacherCredential, MissingCredentialError } from "@/lib/ai/credential";
import type { Assignment } from "@/lib/types/db";

export const runtime = "nodejs";
// PDF를 통째로 Gemini에 보내는 채점은 기본 제한(약 15초)보다 오래 걸려 504로 끊길 수 있어 연장.
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 AI 채점을 실행할 수 있습니다." }, { status: 403 });
  }

  const { submissionId } = await params;
  const supabase = await createClient();

  // RLS: 교사 본인 소유 과제의 제출물만 조회됨 — 조회되면 곧 소유권 검증이 된 것
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, file_path, extracted_text, extraction_status, assignments(*)")
    .eq("id", submissionId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        assignment_id: string;
        file_path: string;
        extracted_text: string | null;
        extraction_status: string;
        assignments: Assignment | null;
      },
      { merge: false }
    >();

  if (!submission) {
    return NextResponse.json({ error: "제출물을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const assignment = submission.assignments;
  if (!assignment) {
    return NextResponse.json({ error: "과제 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: criteria } = await supabase
    .from("grading_criteria")
    .select("criteria_text")
    .eq("assignment_id", submission.assignment_id)
    .maybeSingle();

  if (!criteria?.criteria_text) {
    return NextResponse.json({ error: "이 과제에는 등록된 채점 기준이 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const isPdf = submission.file_path.toLowerCase().endsWith(".pdf");
  let submissionText = submission.extracted_text;
  let pdfBuffer: Buffer | null = null;

  // PDF는 텍스트뿐 아니라 그림/사진/표/그래프까지 채점에 반영되도록 원본을 Gemini에 직접 보낸다.
  if (isPdf) {
    const { data: fileData, error: downloadError } = await admin.storage
      .from("submission-files")
      .download(submission.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "제출 파일을 불러올 수 없습니다." }, { status: 500 });
    }
    pdfBuffer = Buffer.from(await fileData.arrayBuffer());
  } else if (submission.extraction_status !== "ok" || !submissionText) {
    const { data: fileData, error: downloadError } = await admin.storage
      .from("submission-files")
      .download(submission.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "제출 파일을 불러올 수 없습니다." }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    try {
      submissionText = await extractText(buffer, submission.file_path, "");
    } catch (err) {
      const message = err instanceof ExtractionError ? err.message : "텍스트 추출에 실패했습니다.";
      await admin
        .from("submissions")
        .update({ extraction_status: "failed" })
        .eq("id", submission.id);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    await admin
      .from("submissions")
      .update({ extracted_text: submissionText, extraction_status: "ok" })
      .eq("id", submission.id);
  }

  try {
    const baseInput = {
      subject: assignment.subject,
      assignmentTitle: assignment.title,
      scoringType: assignment.scoring_type,
      criteriaText: criteria.criteria_text,
    };
    const cred = await getTeacherCredential(session.profile.id);
    const { payload, rawResponse, modelName } = await gradeSubmission(
      cred,
      pdfBuffer ? { ...baseInput, pdfBuffer } : { ...baseInput, submissionText: submissionText ?? "" },
    );

    const { data: result, error: upsertError } = await admin
      .from("grading_results")
      .upsert(
        {
          submission_id: submission.id,
          score: payload.score ?? null,
          score_label: payload.score_label ?? null,
          ai_feedback: payload.feedback,
          ai_septeuk: payload.septeuk,
          ai_rationale: payload.rationale,
          raw_model_response: rawResponse as never,
          model_name: modelName,
          status: "graded",
          graded_at: new Date().toISOString(),
        },
        { onConflict: "submission_id" },
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: "채점 결과 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof GradingError ? err.message : "AI 채점 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
