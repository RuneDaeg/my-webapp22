import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateTeacherForm } from "@/components/CreateTeacherForm";
import { formatKstDate } from "@/lib/datetime";

export default async function AdminPage() {
  await requireRole("admin");

  // 관리자는 전체 교사 목록을 볼 RLS 경로가 없으므로 service-role로 조회한다 (서버 전용).
  const admin = createAdminClient();
  const { data: teachers } = await admin
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("role", "teacher")
    .order("created_at", { ascending: false });

  // 이메일은 profiles에 없으므로 auth 사용자 목록에서 매핑한다.
  const emailById = new Map<string, string>();
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of userList?.users ?? []) if (u.email) emailById.set(u.id, u.email);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">교사 계정 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          학교에서 사용할 교사 계정을 발급합니다. 교사는 이 계정으로 로그인해 클래스를 운영합니다.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">새 교사 계정 발급</h2>
        <CreateTeacherForm />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">교사 목록 ({teachers?.length ?? 0}명)</h2>
        {!teachers || teachers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            아직 발급된 교사 계정이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {teachers.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.display_name || "(이름 없음)"}</p>
                  <p className="text-xs text-gray-500">{emailById.get(t.id) ?? "-"}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {formatKstDate(t.created_at)} 발급
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
