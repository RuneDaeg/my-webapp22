"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import type { Database, QuizQuestionType } from "@/lib/types/db";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 폼에서 올라온 그림을 quiz-images 버킷에 저장하고 경로를 돌려준다. 파일이 없으면 null.
async function uploadQuestionImage(
  supabase: SupabaseClient<Database>,
  teacherId: string,
  classId: string,
  file: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("그림은 5MB 이하여야 합니다.");

  const ext = file.type === "image/jpeg" ? "jpg" : "png";
  const path = `${teacherId}/${classId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("quiz-images").upload(path, buffer, { contentType: file.type });
  if (error) throw new Error("그림 업로드에 실패했습니다.");
  return path;
}

async function removeQuestionImage(supabase: SupabaseClient<Database>, path: string | null) {
  if (!path) return;
  await supabase.storage.from("quiz-images").remove([path]); // 실패해도 문항 저장을 막지 않는다
}

function parseOptions(raw: string): string[] | null {
  const options = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return options.length > 0 ? options : null;
}

function readQuestionFields(formData: FormData) {
  const classId = String(formData.get("classId") ?? "");
  const unit = String(formData.get("unit") ?? "").trim();
  const type = (formData.get("type") === "subjective" ? "subjective" : "multiple") as QuizQuestionType;
  const content = String(formData.get("content") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const difficulty = Math.min(5, Math.max(1, Number(formData.get("difficulty")) || 3));
  const conceptKeyword = String(formData.get("conceptKeyword") ?? "").trim() || null;
  const optionsRaw = String(formData.get("options") ?? "");
  const options = type === "multiple" ? parseOptions(optionsRaw) : null;

  if (!classId) throw new Error("클래스를 찾을 수 없습니다.");
  if (!unit) throw new Error("단원을 입력해주세요.");
  if (!content) throw new Error("문제 내용을 입력해주세요.");
  if (!answer) throw new Error("정답을 입력해주세요.");
  if (type === "multiple" && (!options || options.length < 2)) {
    throw new Error("객관식은 보기를 2개 이상 입력해주세요.");
  }

  return { classId, unit, type, content, answer, difficulty, conceptKeyword, options };
}

export async function createQuestionAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const supabase = await createClient();
  const fields = readQuestionFields(formData);

  // RLS: 본인 소유 클래스인지 확인
  const { data: classRow } = await supabase.from("classes").select("id").eq("id", fields.classId).maybeSingle();
  if (!classRow) throw new Error("클래스를 찾을 수 없거나 접근 권한이 없습니다.");

  const imagePath = await uploadQuestionImage(supabase, session.userId, fields.classId, formData.get("imageFile"));

  const { error } = await supabase.from("quiz_questions").insert({
    class_id: fields.classId,
    teacher_id: session.userId,
    unit: fields.unit,
    type: fields.type,
    content: fields.content,
    options: fields.options,
    answer: fields.answer,
    difficulty: fields.difficulty,
    concept_keyword: fields.conceptKeyword,
    status: "published",
    image_path: imagePath,
  });
  if (error) throw new Error("문항 생성에 실패했습니다.");

  revalidatePath(`/teacher/classes/${fields.classId}/quiz-bank`);
  redirect(`/teacher/classes/${fields.classId}/quiz-bank`);
}

export async function updateQuestionAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const questionId = String(formData.get("questionId") ?? "");
  if (!questionId) throw new Error("문항을 찾을 수 없습니다.");
  const fields = readQuestionFields(formData);

  const { data: question } = await supabase
    .from("quiz_questions")
    .select("id, image_path")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) throw new Error("문항을 찾을 수 없거나 접근 권한이 없습니다.");

  const newImagePath = await uploadQuestionImage(supabase, session.userId, fields.classId, formData.get("imageFile"));
  const removeRequested = formData.get("removeImage") === "1";

  // 새 파일 업로드 > 삭제 체크 > 기존 유지 순으로 결정
  let imagePath = question.image_path;
  if (newImagePath) {
    await removeQuestionImage(supabase, question.image_path);
    imagePath = newImagePath;
  } else if (removeRequested) {
    await removeQuestionImage(supabase, question.image_path);
    imagePath = null;
  }

  const { error } = await supabase
    .from("quiz_questions")
    .update({
      unit: fields.unit,
      type: fields.type,
      content: fields.content,
      options: fields.options,
      answer: fields.answer,
      difficulty: fields.difficulty,
      concept_keyword: fields.conceptKeyword,
      image_path: imagePath,
    })
    .eq("id", questionId);
  if (error) throw new Error("문항 수정에 실패했습니다.");

  revalidatePath(`/teacher/classes/${fields.classId}/quiz-bank`);
  redirect(`/teacher/classes/${fields.classId}/quiz-bank`);
}

export async function deleteQuestionAction(questionId: string, classId: string): Promise<void> {
  await requireRole("teacher");
  const supabase = await createClient();

  const { data: question } = await supabase
    .from("quiz_questions")
    .select("image_path")
    .eq("id", questionId)
    .maybeSingle();

  const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId);
  if (error) throw new Error("문항 삭제에 실패했습니다.");

  await removeQuestionImage(supabase, question?.image_path ?? null);

  revalidatePath(`/teacher/classes/${classId}/quiz-bank`);
}

// 교사가 학생의 개별 풀이에 코멘트를 남긴다.
export async function saveAttemptFeedbackAction(formData: FormData): Promise<void> {
  await requireRole("teacher");
  const supabase = await createClient();

  const attemptId = String(formData.get("attemptId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const feedback = String(formData.get("teacherFeedback") ?? "").trim();
  if (!attemptId || !classId) throw new Error("잘못된 요청입니다.");

  // RLS: is_teacher_of_class로 본인 클래스 시도만 조회됨 — 조회되면 소유권 확인 완료
  const { data: attempt } = await supabase.from("quiz_attempts").select("id").eq("id", attemptId).maybeSingle();
  if (!attempt) throw new Error("풀이를 찾을 수 없거나 접근 권한이 없습니다.");

  // quiz_attempts에는 교사 UPDATE RLS 정책이 없으므로, 소유권 확인 후 admin으로 코멘트만 갱신한다.
  const admin = createAdminClient();
  const { error } = await admin
    .from("quiz_attempts")
    .update({ teacher_feedback: feedback || null })
    .eq("id", attemptId);
  if (error) throw new Error("피드백 저장에 실패했습니다.");

  revalidatePath(`/teacher/classes/${classId}/quiz-results`);
}

// 교사가 학생별 종합 피드백(총평)을 남긴다.
export async function saveStudentFeedbackAction(formData: FormData): Promise<void> {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const classId = String(formData.get("classId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const feedback = String(formData.get("studentFeedback") ?? "").trim();
  if (!classId || !studentId) throw new Error("잘못된 요청입니다.");

  // 비우면 삭제, 아니면 upsert. RLS(is_teacher_of_class)로 본인 클래스만 허용된다.
  if (!feedback) {
    await supabase.from("quiz_student_feedback").delete().eq("class_id", classId).eq("student_id", studentId);
  } else {
    const { error } = await supabase.from("quiz_student_feedback").upsert(
      {
        class_id: classId,
        student_id: studentId,
        teacher_id: session.userId,
        feedback,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_id,student_id" },
    );
    if (error) throw new Error("종합 피드백 저장에 실패했습니다.");
  }

  revalidatePath(`/teacher/classes/${classId}/quiz-results`);
}
