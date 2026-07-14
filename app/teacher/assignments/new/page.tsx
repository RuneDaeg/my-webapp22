import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { createAssignmentAction } from "@/app/teacher/actions";
import { AssignmentForm } from "@/components/AssignmentForm";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const session = await requireRole("teacher");
  const { classId } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", session.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">새 과제 만들기</h1>
      {!classes || classes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          먼저 클래스를 만들어야 과제를 등록할 수 있습니다.
        </p>
      ) : (
        <AssignmentForm classes={classes} defaultClassId={classId} action={createAssignmentAction} />
      )}
    </div>
  );
}
