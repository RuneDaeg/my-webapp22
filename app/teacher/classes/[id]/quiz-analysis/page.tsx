import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { computeClassStats, type Bucket } from "@/lib/quiz/classStats";
import { ClassAnalysisNarrative } from "@/components/ClassAnalysisNarrative";

function rateColor(rate: number): string {
  if (rate < 40) return "text-red-600";
  if (rate < 70) return "text-amber-600";
  return "text-green-600";
}

function StatTable({ title, buckets }: { title: string; buckets: Bucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {buckets.map((b) => (
          <li key={b.label} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-gray-700">{b.label}</span>
            <span className={`font-medium ${rateColor(b.rate)}`}>
              {b.rate}% <span className="text-xs text-gray-400">({b.correct}/{b.total})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function QuizAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: classRow } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!classRow) notFound();

  const stats = await computeClassStats(supabase, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teacher/classes/${id}/quiz-bank`} className="text-sm text-gray-500 hover:text-gray-900">
          ← 문제은행으로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">클래스 학습 분석</h1>
        <p className="mt-1 text-sm text-gray-500">
          {classRow.name} · 학생 {stats.studentCount}명 · 풀이 {stats.totalAttempts}건
        </p>
      </div>

      {stats.totalAttempts === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 학생이 푼 문제가 없습니다.
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">AI 분석</h2>
            <ClassAnalysisNarrative classId={id} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <StatTable title="개념별 통과율 (낮은 순)" buckets={stats.concepts} />
            <div className="space-y-4">
              <StatTable title="유형별 통과율" buckets={stats.types} />
              <StatTable title="난이도별 통과율" buckets={stats.difficulties} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
