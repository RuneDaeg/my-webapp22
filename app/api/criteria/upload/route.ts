import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { extractText, ExtractionError } from "@/lib/extraction";
import { validateUploadedFile, sanitizeFilename, FileValidationError } from "@/lib/validation/fileValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 채점 기준을 업로드할 수 있습니다." }, { status: 403 });
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

  // RLS: 교사 본인 소유 과제인지 확인 (소유가 아니면 조회되지 않음)
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, teacher_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extractedText: string;
  try {
    extractedText = await extractText(buffer, file.name, file.type);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const filePath = `${session.userId}/${assignmentId}/${sanitizeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("criteria-files")
    .upload(filePath, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return NextResponse.json({ error: "파일 업로드에 실패했습니다." }, { status: 500 });
  }

  const { data: criteria, error: upsertError } = await supabase
    .from("grading_criteria")
    .upsert(
      {
        assignment_id: assignmentId,
        criteria_text: extractedText,
        source_type: "file",
        file_path: filePath,
        file_mime: file.type || "application/octet-stream",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id" },
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: "채점 기준 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ criteria });
}
