import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 · 과제 채점 도우미",
  description: "과제 채점 도우미가 수집하는 개인정보 항목과 처리 방식 안내",
};

// 이 페이지는 로그인 없이 접근 가능해야 한다(가입 전 고지 목적).
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← 처음으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">개인정보처리방침</h1>
        <p className="mt-1 text-sm text-gray-500">
          &quot;과제 채점 도우미&quot;(이하 &quot;서비스&quot;)는 학교 수업 운영을 위해 아래와 같이 개인정보를 처리합니다.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">1. 수집하는 개인정보 항목</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-600">
                <th className="py-2 pr-4">구분</th>
                <th className="py-2 pr-4">항목</th>
                <th className="py-2">수집 방법</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">계정</td>
                <td className="py-2 pr-4 align-top">이메일 주소, 이름(표시 이름), 비밀번호(암호화 저장)</td>
                <td className="py-2 align-top">회원가입 시 이용자 입력 / 관리자의 교사 계정 발급</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">학습 활동</td>
                <td className="py-2 pr-4 align-top">
                  소속 클래스, 과제 제출 파일 및 파일명, 제출물에서 추출한 텍스트, 문제 풀이 답안·정오답 기록
                </td>
                <td className="py-2 align-top">서비스 이용 과정에서 자동 생성·저장</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">평가 결과</td>
                <td className="py-2 pr-4 align-top">
                  AI 채점 점수·피드백·채점 근거, 교사가 작성한 피드백, &quot;과목별 세부능력 및 특기사항&quot; 초안
                </td>
                <td className="py-2 align-top">AI 채점 실행 및 교사 입력 시 생성</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600">
          주민등록번호 등 고유식별정보는 수집하지 않으며, 결제 정보도 수집하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">2. 이용 목적</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>로그인·본인 확인 및 교사/학생 권한 구분</li>
          <li>과제 제출·관리, AI 기반 채점 및 피드백 제공</li>
          <li>학습 진단(취약 개념 분석) 및 교사의 학습 지도 지원</li>
          <li>학교생활기록부 &quot;과목별 세부능력 및 특기사항&quot; 초안 작성 보조 (교사만 열람)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">3. 제3자 제공 및 처리위탁</h2>
        <p className="text-sm text-gray-700">
          서비스는 개인정보를 외부에 판매하지 않습니다. 다만 서비스 제공에 필요한 범위에서 아래 사업자에게
          처리를 위탁합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-600">
                <th className="py-2 pr-4">수탁자</th>
                <th className="py-2 pr-4">위탁 업무</th>
                <th className="py-2">전송되는 정보</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">Supabase</td>
                <td className="py-2 pr-4 align-top">데이터베이스·로그인·파일 저장</td>
                <td className="py-2 align-top">위 1항의 수집 항목 전체</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">Vercel</td>
                <td className="py-2 pr-4 align-top">웹 서비스 호스팅</td>
                <td className="py-2 align-top">서비스 이용 시 발생하는 접속 요청 정보</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 align-top">Google (Gemini API)</td>
                <td className="py-2 pr-4 align-top">AI 채점·피드백·문항 분석 생성</td>
                <td className="py-2 align-top">
                  <strong>과제 제출물 원본/추출 텍스트, 채점 기준, 문제 풀이 답안</strong>
                  <br />
                  (이름·이메일 등 계정 정보는 전송하지 않습니다)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600">
          위 사업자의 서버는 국외에 위치할 수 있으며, 이 경우 개인정보가 국외로 이전됩니다. 서비스 이용은
          이러한 국외 이전에 대한 동의를 포함합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">4. 보유 및 파기</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>계정 및 학습 기록은 서비스 이용 기간(재학·수강 기간) 동안 보유합니다.</li>
          <li>계정이 삭제되면 해당 계정의 제출물·풀이 기록·평가 결과도 함께 삭제됩니다.</li>
          <li>학교의 학사 일정 종료 후에는 담당 교사 또는 관리자가 데이터를 삭제할 수 있습니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">5. 안전성 확보 조치</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>모든 통신은 HTTPS로 암호화되며, 비밀번호는 복호화 불가능한 형태로 저장됩니다.</li>
          <li>
            데이터베이스에 행 수준 보안(RLS)을 적용해, 학생은 본인 데이터와 본인이 속한 클래스 정보만
            조회할 수 있습니다. 다른 학생의 제출물·평가 결과에는 접근할 수 없습니다.
          </li>
          <li>제출 파일은 비공개 저장소에 보관되며, 권한이 확인된 경우에만 한시적 링크로 열람됩니다.</li>
          <li>&quot;세부능력 및 특기사항&quot; 초안과 AI 채점 근거는 교사만 열람할 수 있고 학생에게 공개되지 않습니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">6. 이용자의 권리</h2>
        <p className="text-sm text-gray-700">
          이용자(또는 미성년자의 법정대리인)는 본인의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수
          있습니다. 서비스 내에서 직접 처리하기 어려운 경우 담당 교사 또는 아래 담당자에게 요청하시면
          지체 없이 조치합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">7. 개인정보 보호책임자</h2>
        <p className="text-sm text-gray-700">
          본 서비스는 각 학교(또는 담당 교사)가 자체적으로 설치·운영합니다. 개인정보 관련 문의는 서비스를
          운영하는 담당 교사 또는 소속 학교의 개인정보 보호 담당자에게 연락해 주세요.
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>운영자 안내:</strong> 이 서비스를 학교에 배포해 운영하는 경우, 이 문단을 실제 담당자 이름·
          연락처(이메일)와 학교명으로 바꿔주세요. 학교 상황에 따라 보유기간·위탁 현황도 함께 조정해야 합니다.
        </p>
      </section>

      <section className="space-y-1 border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-500">시행일: 2026년 7월 16일</p>
        <p className="text-xs text-gray-500">
          본 방침이 변경되는 경우 시행일과 변경 내용을 이 페이지에 공지합니다.
        </p>
      </section>
    </div>
  );
}
