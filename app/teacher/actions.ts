"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { generateJoinCode } from "@/lib/joinCode";
import { extractText, ExtractionError } from "@/lib/extraction";
import { validateUploadedFile, sanitizeFilename, FileValidationError } from "@/lib/validation/fileValidation";
import type { AssignmentStatus, ScoringType } from "@/lib/types/db";

export async function createClassAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("클래스 이름을 입력해주세요.");

  const supabase = await createClient();

  let classId: string | null = null;
  for (let attempt = 0; attempt < 5 && !classId; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: session.userId, name, join_code: joinCode })
      .select("id")
      .single();

    if (!error && data) {
      classId = data.id;
    } else if (error && error.code !== "23505") {
      throw new Error("클래스 생성에 실패했습니다.");
    }
  }

  if (!classId) throw new Error("참여 코드 생성에 실패했습니다. 다시 시도해주세요.");

  revalidatePath("/teacher/dashboard");
  redirect(`/teacher/classes/${classId}`);
}

export async function createAssignmentAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const classId = String(formData.get("classId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  const scoringType = (formData.get("scoringType") === "numeric" ? "numeric" : "label") as ScoringType;
  const sourceType = formData.get("sourceType") === "file" ? "file" : "text";
  const criteriaText = String(formData.get("criteriaText") ?? "").trim();
  const file = formData.get("criteriaFile");

  if (!classId) throw new Error("클래스를 선택해주세요.");
  if (!title) throw new Error("과제 제목을 입력해주세요.");

  // RLS: 본인 소유 클래스인지 확인
  const { data: classRow } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (!classRow) throw new Error("클래스를 찾을 수 없거나 접근 권한이 없습니다.");

  if (sourceType === "text" && !criteriaText) {
    throw new Error("채점 기준 텍스트를 입력하거나 파일을 업로드해주세요.");
  }
  if (sourceType === "file" && !(file instanceof File && file.size > 0)) {
    throw new Error("채점 기준 파일을 선택해주세요.");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .insert({
      class_id: classId,
      teacher_id: session.userId,
      title,
      subject,
      description,
      due_at: dueAt,
      scoring_type: scoringType,
      status: "open",
    })
    .select("id")
    .single();

  if (assignmentError || !assignment) throw new Error("과제 생성에 실패했습니다.");

  if (sourceType === "text") {
    const { error } = await supabase
      .from("grading_criteria")
      .insert({ assignment_id: assignment.id, criteria_text: criteriaText, source_type: "text" });
    if (error) throw new Error("채점 기준 저장에 실패했습니다.");
  } else if (file instanceof File) {
    try {
      validateUploadedFile(file);
    } catch (err) {
      throw new Error(err instanceof FileValidationError ? err.message : "파일이 올바르지 않습니다.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extracted: string;
    try {
      extracted = await extractText(buffer, file.name, file.type);
    } catch (err) {
      throw new Error(err instanceof ExtractionError ? err.message : "텍스트 추출에 실패했습니다.");
    }

    const filePath = `${session.userId}/${assignment.id}/${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("criteria-files")
      .upload(filePath, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });
    if (uploadError) throw new Error("채점 기준 파일 업로드에 실패했습니다.");

    const { error } = await supabase.from("grading_criteria").insert({
      assignment_id: assignment.id,
      criteria_text: extracted,
      source_type: "file",
      file_path: filePath,
      file_mime: file.type || "application/octet-stream",
    });
    if (error) throw new Error("채점 기준 저장에 실패했습니다.");
  }

  revalidatePath(`/teacher/classes/${classId}`);
  redirect(`/teacher/assignments/${assignment.id}`);
}

export async function setAssignmentStatusAction(assignmentId: string, status: AssignmentStatus): Promise<void> {
  await requireRole("teacher");
  const supabase = await createClient();

  const { error } = await supabase.from("assignments").update({ status }).eq("id", assignmentId);
  if (error) throw new Error("과제 상태 변경에 실패했습니다.");

  revalidatePath(`/teacher/assignments/${assignmentId}`);
}

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const classId = String(formData.get("classId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!classId) throw new Error("클래스를 찾을 수 없습니다.");
  if (!body) throw new Error("공지 내용을 입력해주세요.");

  // RLS(is_teacher_of_class)로 본인 클래스만 허용됨
  const { error } = await supabase
    .from("class_announcements")
    .insert({ class_id: classId, teacher_id: session.userId, body });
  if (error) throw new Error("공지 등록에 실패했습니다.");

  revalidatePath(`/teacher/classes/${classId}`);
}

export async function deleteAnnouncementAction(announcementId: string, classId: string): Promise<void> {
  await requireRole("teacher");
  const supabase = await createClient();

  const { error } = await supabase.from("class_announcements").delete().eq("id", announcementId);
  if (error) throw new Error("공지 삭제에 실패했습니다.");

  revalidatePath(`/teacher/classes/${classId}`);
}

export async function updateAssignmentAction(formData: FormData): Promise<void> {
  await requireRole("teacher");
  const supabase = await createClient();

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  const scoringType = (formData.get("scoringType") === "numeric" ? "numeric" : "label") as ScoringType;
  const status = String(formData.get("status") ?? "draft") as AssignmentStatus;
  const criteriaText = String(formData.get("criteriaText") ?? "").trim();

  if (!assignmentId) throw new Error("과제를 찾을 수 없습니다.");
  if (!title) throw new Error("과제 제목을 입력해주세요.");
  if (!criteriaText) throw new Error("채점 기준을 입력해주세요.");

  // RLS: 본인 소유 과제인지 확인
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) throw new Error("과제를 찾을 수 없거나 접근 권한이 없습니다.");

  const { error: updateError } = await supabase
    .from("assignments")
    .update({ title, subject, description, due_at: dueAt, scoring_type: scoringType, status })
    .eq("id", assignmentId);
  if (updateError) throw new Error("과제 수정에 실패했습니다.");

  const { error: criteriaError } = await supabase
    .from("grading_criteria")
    .update({ criteria_text: criteriaText, updated_at: new Date().toISOString() })
    .eq("assignment_id", assignmentId);
  if (criteriaError) throw new Error("채점 기준 수정에 실패했습니다.");

  revalidatePath(`/teacher/assignments/${assignmentId}`);
  redirect(`/teacher/assignments/${assignmentId}`);
}
