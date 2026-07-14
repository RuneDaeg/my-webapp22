import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { PlanImportWizard } from "@/components/PlanImportWizard";

export default async function ImportPlanPage() {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", session.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">평가계획으로 과제 일괄 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          학기 평가계획 문서를 업로드하면 수행평가 항목별로 과제를 자동으로 나눠 만들어드립니다.
        </p>
      </div>

      {!classes || classes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          먼저 클래스를 만들어야 과제를 등록할 수 있습니다.
        </p>
      ) : (
        <PlanImportWizard classes={classes} />
      )}
    </div>
  );
}
