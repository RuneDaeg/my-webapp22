import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { computeTeacherDashboard } from "@/lib/teacher/dashboard";
import { formatKstDate } from "@/lib/datetime";

function rateColor(rate: number): string {
  if (rate < 40) return "text-red-600";
  if (rate < 70) return "text-amber-600";
  return "text-green-600";
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent && value > 0 ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent && value > 0 ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

export default async function TeacherDashboardPage() {
  const session = await requireRole("teacher");
  const supabase = await createClient();

  const [{ data: classes }, dash] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, join_code, created_at")
      .eq("teacher_id", session.userId)
      .order("created_at", { ascending: false }),
    computeTeacherDashboard(supabase, session.userId),
  ]);

  const hasClasses = (classes?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="flex gap-2">
          <Link
            href="/teacher/assignments/import"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            평가계획으로 과제 일괄 만들기
          </Link>
          <Link
            href="/teacher/classes/new"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + 클래스 만들기
          </Link>
        </div>
      </div>

      {!hasClasses ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          아직 만든 클래스가 없습니다. 클래스를 만들고 학생에게 참여 코드를 공유해보세요.
        </p>
      ) : (
        <>
          {/* ① 상단 요약 타일 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="담당 클래스" value={dash.summary.classCount} />
            <StatTile label="전체 학생" value={dash.summary.studentCount} />
            <StatTile label="진행중 과제" value={dash.summary.openAssignmentCount} />
            <StatTile label="검토 대기 제출물" value={dash.summary.pendingReviewCount} accent />
          </div>

          {/* ② 검토·채점 대기 */}
          {dash.pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">검토·채점 대기</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {dash.pending.map((p) => (
                  <li key={p.assignmentId}>
                    <Link
                      href={`/teacher/assignments/${p.assignmentId}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.className}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {p.count}건 검토 필요
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ③ 마감 임박 과제 */}
          {dash.deadlines.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">마감 임박 과제 (7일 이내)</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {dash.deadlines.map((d) => (
                  <li key={d.assignmentId}>
                    <Link
                      href={`/teacher/assignments/${d.assignmentId}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.title}</p>
                        <p className="text-xs text-gray-500">
                          {d.className} · 마감 {formatKstDate(d.dueAt)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        제출 {d.submitted}/{d.enrolled}명
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ④ 정답률 + 지원 필요 학생 */}
          {(dash.classQuiz.length > 0 || dash.needSupport.length > 0) && (
            <section className="grid gap-4 sm:grid-cols-2">
              {dash.classQuiz.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">클래스별 문제풀이 정답률</h2>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                    {dash.classQuiz.map((c) => (
                      <li key={c.classId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <Link href={`/teacher/classes/${c.classId}/quiz-analysis`} className="text-gray-700 hover:text-gray-900">
                          {c.className}
                        </Link>
                        <span className={`font-medium ${rateColor(c.rate)}`}>
                          {c.rate}% <span className="text-xs text-gray-400">({c.correct}/{c.total})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dash.needSupport.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">학습 지원이 필요한 학생</h2>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                    {dash.needSupport.map((s) => (
                      <li key={s.studentId} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.className} · 정답률 {s.passRate}%
                          </p>
                        </div>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                          복습 필요 {s.weakConcepts}개
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* 클래스 목록 */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">내 클래스</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {classes!.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-400"
                  >
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      참여 코드: <span className="font-mono font-medium text-gray-700">{c.join_code}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
