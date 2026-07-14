import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GradingResult } from "@/lib/types/db";

export const runtime = "nodejs";

interface PatchBody {
  final_score?: number | null;
  final_feedback?: string | null;
  final_septeuk?: string | null;
  visible_to_student?: boolean;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 채점 결과를 검토할 수 있습니다." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // RLS: 교사 본인 소유 과제의 결과만 조회됨 — 조회되면 소유권 검증 완료
  const { data: existing } = await supabase.from("grading_results").select("id").eq("id", id).maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "채점 결과를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });

  const update: Partial<GradingResult> = {};
  if ("final_score" in body) update.final_score = body.final_score;
  if ("final_feedback" in body) update.final_feedback = body.final_feedback;
  if ("final_septeuk" in body) update.final_septeuk = body.final_septeuk;
  if ("visible_to_student" in body) {
    update.visible_to_student = body.visible_to_student;
    if (body.visible_to_student) {
      update.status = "reviewed";
      update.reviewed_at = new Date().toISOString();
    }
  }

  const { data: result, error } = await createAdminClient()
    .from("grading_results")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });

  return NextResponse.json({ result });
}
