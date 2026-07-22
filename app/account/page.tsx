import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { AiCredentialForm } from "@/components/AiCredentialForm";
import { getTeacherCredentialStatus } from "@/lib/ai/credential";

const ROLE_LABEL: Record<string, string> = { admin: "관리자", teacher: "교사", student: "학생" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isTeacher = session.profile.role === "teacher";
  const aiStatus = isTeacher ? await getTeacherCredentialStatus(session.profile.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          {session.profile.display_name} · {ROLE_LABEL[session.profile.role] ?? session.profile.role}
          {session.email ? ` · ${session.email}` : ""}
        </p>
      </div>

      {isTeacher && aiStatus && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">생성형 AI API 키</h2>
          <p className="text-sm text-gray-500">
            AI 채점·피드백·세특 초안·문항 추출·클래스 분석은 <strong>선생님 본인의 API 키</strong>로 실행됩니다.
            제공사(Google Gemini / OpenAI / Anthropic)를 골라 키를 등록해주세요. 키는 서버에만 저장되며 화면에
            다시 표시되지 않습니다.
          </p>
          <AiCredentialForm hasKey={aiStatus.hasKey} provider={aiStatus.provider} model={aiStatus.model} />
        </section>
      )}

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
