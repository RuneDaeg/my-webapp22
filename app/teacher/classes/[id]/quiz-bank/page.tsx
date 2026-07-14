import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { deleteQuestionAction } from "@/app/teacher/quiz-actions";
import { MathText } from "@/components/MathText";
import type { QuizQuestion } from "@/lib/types/db";

const TYPE_LABEL: Record<string, string> = { multiple: "객관식", subjective: "서술형" };

export default async function QuizBankPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: classRow } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!classRow) notFound();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("class_id", id)
    .order("unit", { ascending: true })
    .order("difficulty", { ascending: true })
    .overrideTypes<QuizQuestion[], { merge: false }>();

  const byUnit = new Map<string, QuizQuestion[]>();
  for (const q of questions ?? []) {
    const list = byUnit.get(q.unit) ?? [];
    list.push(q);
    byUnit.set(q.unit, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/teacher/classes/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
            ← {classRow.name}(으)로 돌아가기
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">문제은행</h1>
          <p className="mt-1 text-sm text-gray-500">
            {classRow.name} · 총 {questions?.length ?? 0}문항
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/teacher/classes/${id}/quiz-analysis`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            클래스 분석
          </Link>
          <Link
            href={`/teacher/classes/${id}/quiz-results`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            학생 피드백
          </Link>
          <Link
            href={`/teacher/classes/${id}/quiz-bank/import`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            PDF로 일괄 추가
          </Link>
          <Link
            href={`/teacher/classes/${id}/quiz-bank/new`}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + 새 문항 추가
          </Link>
        </div>
      </div>

      {byUnit.size === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 등록된 문항이 없습니다.
        </p>
      ) : (
        Array.from(byUnit.entries()).map(([unit, items]) => (
          <section key={unit} className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {unit} <span className="text-sm font-normal text-gray-400">({items.length}문항)</span>
            </h2>
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
              {items.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      <MathText text={q.content.replace(/\n/g, " ")} />
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {TYPE_LABEL[q.type]} · 난이도 {q.difficulty}
                      {q.concept_keyword ? ` · ${q.concept_keyword}` : ""}
                      {q.image_path ? " · 🖼 그림" : ""}
                      {q.status === "pending_review" ? " · 검토 대기" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/teacher/classes/${id}/quiz-bank/${q.id}/edit`}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      수정
                    </Link>
                    <form action={deleteQuestionAction.bind(null, q.id, id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
