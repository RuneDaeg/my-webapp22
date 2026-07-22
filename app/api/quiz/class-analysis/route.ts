import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { computeClassStats, statsSignature } from "@/lib/quiz/classStats";
import { generateClassAnalysis } from "@/lib/gemini/quizFeedback";
import { GradingError } from "@/lib/gemini/grade";
import { getTeacherCredential, MissingCredentialError } from "@/lib/ai/credential";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  classId: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 이용할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.classId) return NextResponse.json({ error: "classId가 필요합니다." }, { status: 400 });

  const supabase = await createClient();

  // RLS: 본인 클래스만 조회됨 (소유권 검증 겸용)
  const { data: cls } = await supabase.from("classes").select("name").eq("id", body.classId).maybeSingle();
  if (!cls) return NextResponse.json({ error: "클래스를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 403 });

  const stats = await computeClassStats(supabase, body.classId);
  if (stats.totalAttempts === 0) {
    return NextResponse.json({ analysis: null });
  }

  const signature = statsSignature(stats);

  // 집계가 그대로면 저장된 분석을 재사용 → 새로고침해도 텍스트가 안 바뀜.
  const { data: cached } = await supabase
    .from("quiz_class_analysis")
    .select("signature, analysis, updated_at")
    .eq("class_id", body.classId)
    .maybeSingle();

  if (cached && cached.signature === signature) {
    return NextResponse.json({ analysis: cached.analysis, updatedAt: cached.updated_at });
  }

  let analysis: string;
  try {
    const cred = await getTeacherCredential(session.profile.id);
    analysis = await generateClassAnalysis(cred, cls.name, stats);
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof GradingError ? err.message : "클래스 분석 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("quiz_class_analysis")
    .upsert({ class_id: body.classId, signature, analysis, updated_at: now }, { onConflict: "class_id" });

  return NextResponse.json({ analysis, updatedAt: now });
}
