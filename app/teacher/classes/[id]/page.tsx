import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { deleteAnnouncementAction } from "@/app/teacher/actions";
import { formatKstDate, formatKstDateTime } from "@/lib/datetime";

const STATUS_LABEL: Record<string, string> = { draft: "임시저장", open: "진행중", closed: "마감" };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  const { data: classRow } = await supabase
    .from("classes")
    .select("id, name, join_code")
    .eq("id", id)
    .maybeSingle();

  if (!classRow) notFound();

  const [{ data: enrollments }, { data: assignments }, { data: announcements }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("id, joined_at, profiles(display_name)")
      .eq("class_id", id)
      .order("joined_at", { ascending: true })
      .overrideTypes<
        Array<{ id: string; joined_at: string; profiles: { display_name: string } | null }>,
        { merge: false }
      >(),
    supabase
      .from("assignments")
      .select("id, title, status, due_at, created_at")
      .eq("class_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("class_announcements")
      .select("id, body, created_at")
      .eq("class_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } =
    assignmentIds.length > 0
      ? await supabase.from("submissions").select("assignment_id").in("assignment_id", assignmentIds)
      : { data: [] as { assignment_id: string }[] };

  const submissionCounts = new Map<string, number>();
  for (const s of submissions ?? []) {
    submissionCounts.set(s.assignment_id, (submissionCounts.get(s.assignment_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{classRow.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          참여 코드: <span className="font-mono font-medium text-gray-700">{classRow.join_code}</span> · 학생 수{" "}
          {enrollments?.length ?? 0}명
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">공지</h2>
        <AnnouncementForm classId={classRow.id} />
        {announcements && announcements.length > 0 && (
          <ul className="space-y-2">
            {announcements.map((n) => (
              <li key={n.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{n.body}</p>
                  <form action={deleteAnnouncementAction.bind(null, n.id, classRow.id)}>
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </form>
                </div>
                <p className="mt-1 text-xs text-gray-400">{formatKstDateTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">과제</h2>
          <div className="flex gap-2">
            <Link
              href={`/teacher/classes/${classRow.id}/quiz-bank`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              문제은행
            </Link>
            <Link
              href={`/teacher/assignments/new?classId=${classRow.id}`}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              + 새 과제
            </Link>
          </div>
        </div>

        {!assignments || assignments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            아직 등록된 과제가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {assignments.map((a) => (
              <li key={a.id}>
                <Link href={`/teacher/assignments/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      제출 {submissionCounts.get(a.id) ?? 0}건
                      {a.due_at ? ` · 마감 ${formatKstDate(a.due_at)}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">참여 학생</h2>
        {!enrollments || enrollments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            참여 코드를 학생에게 공유해 클래스에 초대해보세요.
          </p>
        ) : (
          <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
            {enrollments.map((e) => (
              <li key={e.id} className="px-4 py-2 text-sm text-gray-700">
                {e.profiles?.display_name?.trim() || "(이름 없음)"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
