import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText, ExtractionError } from "@/lib/extraction";
import { validateUploadedFile, sanitizeFilename, FileValidationError } from "@/lib/validation/fileValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "student") {
    return NextResponse.json({ error: "학생만 과제를 제출할 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const assignmentId = formData?.get("assignmentId");
  const file = formData?.get("file");

  if (typeof assignmentId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "assignmentId와 file이 필요합니다." }, { status: 400 });
  }

  try {
    validateUploadedFile(file);
  } catch (err) {
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const supabase = await createClient();

  // RLS: 자신이 속한 클래스의 과제인지 확인 (아니면 조회되지 않음)
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }
  if (assignment.status !== "open") {
    return NextResponse.json({ error: "제출 기간이 아닌 과제입니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = (file.name.toLowerCase().split(".").pop() ?? "") === "pdf";

  let extractedText: string;
  try {
    // PDF는 채점 시 원본을 Gemini가 직접 보므로(그림/스캔 포함), 텍스트가 거의 없어도 허용한다.
    extractedText = await extractText(buffer, file.name, file.type, { allowSparseText: isPdf });
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, file_path")
    .eq("assignment_id", assignmentId)
    .eq("student_id", session.userId)
    .maybeSingle();

  const filePath = `${session.userId}/${assignmentId}/${sanitizeFilename(file.name)}`;

  if (existing && existing.file_path !== filePath) {
    await supabase.storage.from("submission-files").remove([existing.file_path]);
  }

  const { error: uploadError } = await supabase.storage
    .from("submission-files")
    .upload(filePath, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    console.error("submissions upload storage error:", JSON.stringify(uploadError), "filePath:", filePath);
    return NextResponse.json({ error: "파일 업로드에 실패했습니다." }, { status: 500 });
  }

  const { data: submission, error: upsertError } = await supabase
    .from("submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: session.userId,
        file_path: filePath,
        file_mime: file.type || "application/octet-stream",
        original_filename: file.name,
        extracted_text: extractedText,
        extraction_status: "ok",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: "제출물 저장에 실패했습니다." }, { status: 500 });
  }

  // 재제출 시 이전 AI 채점 결과는 더 이상 최신 제출물을 반영하지 않으므로 초기화한다.
  // grading_results는 서버(service-role)에서만 쓸 수 있으므로 admin 클라이언트를 사용한다.
  if (existing) {
    await createAdminClient().from("grading_results").delete().eq("submission_id", existing.id);
  }

  return NextResponse.json({ submission });
}
