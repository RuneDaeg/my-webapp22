import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { getMasteredQuestionIds } from "@/lib/quiz/adaptive";

export default async function QuizClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const session = await requireRole("student");
  const { classId } = await params;
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id, classes(name)")
    .eq("class_id", classId)
    .eq("student_id", session.userId)
    .maybeSingle()
    .overrideTypes<{ id: string; classes: { name: string } | null }, { merge: false }>();

  if (!enrollment) notFound();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, unit")
    .eq("class_id", classId)
    .eq("status", "published");

  const masteredIds = await getMasteredQuestionIds(
    supabase,
    session.userId,
    (questions ?? []).map((q) => q.id),
  );

  const byUnit = new Map<string, { total: number; mastered: number }>();
  for (const q of questions ?? []) {
    const entry = byUnit.get(q.unit) ?? { total: 0, mastered: 0 };
    entry.total += 1;
    if (masteredIds.has(q.id)) entry.mastered += 1;
    byUnit.set(q.unit, entry);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">문제 풀기</h1>
        <p className="mt-1 text-sm text-gray-500">{enrollment.classes?.name}</p>
      </div>

      {byUnit.size === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 등록된 문항이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {Array.from(byUnit.entries()).map(([unit, stat]) => (
            <li key={unit}>
              <Link
                href={`/student/quiz/${classId}/${encodeURIComponent(unit)}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <p className="font-medium text-gray-900">{unit}</p>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {stat.mastered}/{stat.total} 마스터
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
