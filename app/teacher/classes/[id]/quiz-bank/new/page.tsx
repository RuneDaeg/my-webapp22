import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { createQuestionAction } from "@/app/teacher/quiz-actions";
import { QuestionForm } from "@/components/QuestionForm";

export default async function NewQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: classRow } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!classRow) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/teacher/classes/${id}/quiz-bank`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 문제은행으로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">새 문항 추가</h1>
        <p className="mt-1 text-sm text-gray-500">{classRow.name} 문제은행</p>
      </div>
      <QuestionForm classId={classRow.id} action={createQuestionAction} submitLabel="문항 추가" />
    </div>
  );
}
