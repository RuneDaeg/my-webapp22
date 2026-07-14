import { createAdminClient } from "@/lib/supabase/admin";
import type { QuizQuestion } from "@/lib/types/db";

export type QuizQuestionWithImage = QuizQuestion & { imageUrl: string | null };

// 학생은 교사 소유의 quiz-images 객체에 storage RLS로 접근할 수 없으므로, 문항 조회 권한이
// RLS로 이미 검증된 quiz API 안에서만 admin 클라이언트로 signed URL을 발급해 붙여준다.
export async function attachImageUrl(question: QuizQuestion | null): Promise<QuizQuestionWithImage | null> {
  if (!question) return null;
  if (!question.image_path) return { ...question, imageUrl: null };

  const admin = createAdminClient();
  const { data } = await admin.storage.from("quiz-images").createSignedUrl(question.image_path, 60 * 60);
  return { ...question, imageUrl: data?.signedUrl ?? null };
}
