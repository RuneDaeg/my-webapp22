import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

type Client = SupabaseClient<Database>;

export interface DashboardSummary {
  classCount: number;
  studentCount: number;
  openAssignmentCount: number;
  pendingReviewCount: number;
}

export interface PendingAssignment {
  assignmentId: string;
  title: string;
  className: string;
  count: number;
}

export interface DeadlineItem {
  assignmentId: string;
  title: string;
  className: string;
  dueAt: string;
  submitted: number;
  enrolled: number;
}

export interface ClassQuizStat {
  classId: string;
  className: string;
  total: number;
  correct: number;
  rate: number; // 0~100
}

export interface SupportStudent {
  studentId: string;
  name: string;
  className: string;
  weakConcepts: number;
  passRate: number; // 0~100
  attempts: number;
}

export interface TeacherDashboard {
  summary: DashboardSummary;
  pending: PendingAssignment[];
  deadlines: DeadlineItem[];
  classQuiz: ClassQuizStat[];
  needSupport: SupportStudent[];
}

const DAY = 24 * 60 * 60 * 1000;

// 교사 대시보드에 필요한 집계를 한 번에 계산한다. 모든 조회는 RLS로 교사 본인 소유 범위로 제한된다.
export async function computeTeacherDashboard(supabase: Client, teacherId: string): Promise<TeacherDashboard> {
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", teacherId);

  const classList = classes ?? [];
  const classIds = classList.map((c) => c.id);
  const classNameById = new Map(classList.map((c) => [c.id, c.name]));

  const empty: TeacherDashboard = {
    summary: { classCount: 0, studentCount: 0, openAssignmentCount: 0, pendingReviewCount: 0 },
    pending: [],
    deadlines: [],
    classQuiz: [],
    needSupport: [],
  };
  if (classIds.length === 0) return empty;

  const [{ data: enrollments }, { data: assignments }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("class_id, student_id, profiles(display_name)")
      .in("class_id", classIds)
      .overrideTypes<
        Array<{ class_id: string; student_id: string; profiles: { display_name: string } | null }>,
        { merge: false }
      >(),
    supabase
      .from("assignments")
      .select("id, title, status, due_at, class_id")
      .eq("teacher_id", teacherId),
  ]);

  const enrollList = enrollments ?? [];
  const assignmentList = assignments ?? [];
  const assignmentIds = assignmentList.map((a) => a.id);

  // 학생 이름 / 소속 클래스 매핑
  const studentName = new Map<string, string>();
  const studentClassName = new Map<string, string>();
  const enrolledByClass = new Map<string, number>();
  for (const e of enrollList) {
    studentName.set(e.student_id, e.profiles?.display_name?.trim() || "(이름 없음)");
    if (!studentClassName.has(e.student_id)) {
      studentClassName.set(e.student_id, classNameById.get(e.class_id) ?? "클래스");
    }
    enrolledByClass.set(e.class_id, (enrolledByClass.get(e.class_id) ?? 0) + 1);
  }

  // 제출물 + 채점 상태
  const { data: submissions } =
    assignmentIds.length > 0
      ? await supabase
          .from("submissions")
          .select("id, assignment_id, grading_results(visible_to_student)")
          .in("assignment_id", assignmentIds)
          .overrideTypes<
            Array<{ id: string; assignment_id: string; grading_results: { visible_to_student: boolean } | null }>,
            { merge: false }
          >()
      : { data: [] };

  const submissionList = submissions ?? [];
  const submittedCount = new Map<string, number>();
  const pendingCount = new Map<string, number>();
  for (const s of submissionList) {
    submittedCount.set(s.assignment_id, (submittedCount.get(s.assignment_id) ?? 0) + 1);
    // 학생에게 공개되지 않은 제출물 = 채점 또는 검토가 필요함
    if (!s.grading_results?.visible_to_student) {
      pendingCount.set(s.assignment_id, (pendingCount.get(s.assignment_id) ?? 0) + 1);
    }
  }

  const assignmentTitle = new Map(assignmentList.map((a) => [a.id, a.title]));
  const assignmentClassName = new Map(
    assignmentList.map((a) => [a.id, classNameById.get(a.class_id) ?? "클래스"]),
  );

  const pending: PendingAssignment[] = Array.from(pendingCount.entries())
    .map(([assignmentId, count]) => ({
      assignmentId,
      title: assignmentTitle.get(assignmentId) ?? "과제",
      className: assignmentClassName.get(assignmentId) ?? "클래스",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const pendingReviewCount = pending.reduce((sum, p) => sum + p.count, 0);

  // 마감 임박 (진행중 + 오늘~7일 내)
  const now = Date.now();
  const deadlines: DeadlineItem[] = assignmentList
    .filter((a) => a.status === "open" && a.due_at && new Date(a.due_at).getTime() >= now - DAY)
    .filter((a) => new Date(a.due_at as string).getTime() <= now + 7 * DAY)
    .map((a) => ({
      assignmentId: a.id,
      title: a.title,
      className: classNameById.get(a.class_id) ?? "클래스",
      dueAt: a.due_at as string,
      submitted: submittedCount.get(a.id) ?? 0,
      enrolled: enrolledByClass.get(a.class_id) ?? 0,
    }))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  // 문제풀이 집계 (클래스별 정답률 + 학생별 미숙 개념)
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("student_id, class_id, is_correct, created_at, quiz_questions(concept_keyword)")
    .in("class_id", classIds)
    .order("created_at", { ascending: true })
    .limit(5000)
    .overrideTypes<
      Array<{
        student_id: string;
        class_id: string;
        is_correct: boolean;
        created_at: string;
        quiz_questions: { concept_keyword: string | null } | null;
      }>,
      { merge: false }
    >();

  const attemptList = attempts ?? [];

  const classAgg = new Map<string, { total: number; correct: number }>();
  const studentAgg = new Map<string, { total: number; correct: number }>();
  // (student, concept) 최신 시도 정오답 — 오래된 것부터 순회하므로 마지막 값이 최신
  const latestByConcept = new Map<string, boolean>();

  for (const a of attemptList) {
    const c = classAgg.get(a.class_id) ?? { total: 0, correct: 0 };
    c.total += 1;
    if (a.is_correct) c.correct += 1;
    classAgg.set(a.class_id, c);

    const s = studentAgg.get(a.student_id) ?? { total: 0, correct: 0 };
    s.total += 1;
    if (a.is_correct) s.correct += 1;
    studentAgg.set(a.student_id, s);

    const kw = a.quiz_questions?.concept_keyword;
    if (kw) latestByConcept.set(`${a.student_id}|${kw}`, a.is_correct);
  }

  const classQuiz: ClassQuizStat[] = classList
    .map((c) => {
      const agg = classAgg.get(c.id) ?? { total: 0, correct: 0 };
      return {
        classId: c.id,
        className: c.name,
        total: agg.total,
        correct: agg.correct,
        rate: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => a.rate - b.rate);

  const weakByStudent = new Map<string, number>();
  for (const [key, correct] of latestByConcept) {
    if (!correct) {
      const studentId = key.split("|")[0];
      weakByStudent.set(studentId, (weakByStudent.get(studentId) ?? 0) + 1);
    }
  }

  const needSupport: SupportStudent[] = Array.from(weakByStudent.entries())
    .map(([studentId, weakConcepts]) => {
      const agg = studentAgg.get(studentId) ?? { total: 0, correct: 0 };
      return {
        studentId,
        name: studentName.get(studentId) ?? "(이름 없음)",
        className: studentClassName.get(studentId) ?? "클래스",
        weakConcepts,
        passRate: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
        attempts: agg.total,
      };
    })
    .sort((a, b) => b.weakConcepts - a.weakConcepts || a.passRate - b.passRate)
    .slice(0, 5);

  return {
    summary: {
      classCount: classList.length,
      studentCount: enrollList.length,
      openAssignmentCount: assignmentList.filter((a) => a.status === "open").length,
      pendingReviewCount,
    },
    pending,
    deadlines,
    classQuiz,
    needSupport,
  };
}
