import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

const ROLE_LABEL: Record<string, string> = { admin: "관리자", teacher: "교사", student: "학생" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          {session.profile.display_name} · {ROLE_LABEL[session.profile.role] ?? session.profile.role}
          {session.email ? ` · ${session.email}` : ""}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">비밀번호 변경</h2>
        <p className="text-sm text-gray-500">
          관리자에게 발급받은 임시 비밀번호를 쓰고 있다면, 본인만 아는 비밀번호로 바꿔주세요.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
