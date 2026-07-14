import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { updateQuestionAction } from "@/app/teacher/quiz-actions";
import { QuestionForm } from "@/components/QuestionForm";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>;
}) {
  await requireRole("teacher");
  const { id, questionId } = await params;
  const supabase = await createClient();

  const { data: question } = await supabase
    .from("quiz_questions")
    .select("id, unit, type, content, options, answer, difficulty, concept_keyword, image_path")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) notFound();

  // 본인 소유 파일이라 storage RLS(owner) 정책으로 세션 클라이언트 서명이 가능하다
  let currentImageUrl: string | null = null;
  if (question.image_path) {
    const { data: signed } = await supabase.storage
      .from("quiz-images")
      .createSignedUrl(question.image_path, 60 * 10);
    currentImageUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/teacher/classes/${id}/quiz-bank`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 문제은행으로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">문항 수정</h1>
      </div>
      <QuestionForm
        classId={id}
        action={updateQuestionAction}
        submitLabel="저장"
        currentImageUrl={currentImageUrl}
        defaultValues={{
          questionId: question.id,
          unit: question.unit,
          type: question.type,
          content: question.content,
          options: question.options,
          answer: question.answer,
          difficulty: question.difficulty,
          conceptKeyword: question.concept_keyword,
        }}
      />
    </div>
  );
}
