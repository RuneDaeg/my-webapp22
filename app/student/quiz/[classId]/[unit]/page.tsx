import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { QuizSession } from "@/components/QuizSession";

export default async function QuizUnitPage({
  params,
}: {
  params: Promise<{ classId: string; unit: string }>;
}) {
  const session = await requireRole("student");
  const { classId, unit } = await params;
  const decodedUnit = decodeURIComponent(unit);
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id, classes(name)")
    .eq("class_id", classId)
    .eq("student_id", session.userId)
    .maybeSingle()
    .overrideTypes<{ id: string; classes: { name: string } | null }, { merge: false }>();

  if (!enrollment) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href={`/student/quiz/${classId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← 단원 목록으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{decodedUnit}</h1>
        <p className="mt-1 text-sm text-gray-500">{enrollment.classes?.name}</p>
      </div>
      <QuizSession classId={classId} unit={decodedUnit} />
    </div>
  );
}
