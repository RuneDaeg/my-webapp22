import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { selectNextQuestion } from "@/lib/quiz/adaptive";
import { attachImageUrl } from "@/lib/quiz/image";

export const runtime = "nodejs";

interface StartBody {
  classId: string;
  unit: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "student") {
    return NextResponse.json({ error: "학생만 문제를 풀 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as StartBody | null;
  if (!body?.classId || !body?.unit) {
    return NextResponse.json({ error: "classId와 unit이 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS: 본인 등록 클래스만 조회됨
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", body.classId)
    .eq("student_id", session.userId)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "이 클래스에 등록되어 있지 않습니다." }, { status: 403 });
  }

  // GAS 원본은 세션 시작 시 이미 마스터한 문제도 다시 낼 수 있었는데, 여기서는 마스터한 문제는
  // 시작 시점부터 제외하도록 개선했다 (selectNextQuestion이 항상 마스터 여부를 걸러냄).
  const question = await selectNextQuestion({
    supabase,
    classId: body.classId,
    unit: body.unit,
    studentId: session.userId,
    targetDifficulty: 3,
  });

  return NextResponse.json({ question: await attachImageUrl(question) });
}
