import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import type { ScoringType } from "@/lib/types/db";

export const runtime = "nodejs";

interface BulkImportItem {
  title: string;
  subject?: string | null;
  scoring_type?: ScoringType;
  criteria_text: string;
}

interface BulkImportBody {
  classIds: string[];
  items: BulkImportItem[];
}

interface ResultEntry {
  classId: string;
  title: string;
  assignmentId?: string;
  error?: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 과제를 일괄 생성할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as BulkImportBody | null;
  if (!body || !Array.isArray(body.classIds) || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  if (body.classIds.length === 0 || body.items.length === 0) {
    return NextResponse.json({ error: "클래스와 항목을 하나 이상 선택해주세요." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS: 본인 소유 클래스만 조회됨 — 요청에 남의 클래스 id가 섞였으면 여기서 걸러진다.
  const { data: ownedClasses } = await supabase.from("classes").select("id").in("id", body.classIds);
  const ownedClassIds = new Set((ownedClasses ?? []).map((c) => c.id));
  const invalidClassIds = body.classIds.filter((id) => !ownedClassIds.has(id));

  if (invalidClassIds.length > 0) {
    return NextResponse.json(
      { error: "일부 클래스에 접근 권한이 없습니다.", invalidClassIds },
      { status: 403 },
    );
  }

  const results: ResultEntry[] = [];

  for (const classId of body.classIds) {
    for (const item of body.items) {
      const title = item.title?.trim();
      const criteriaText = item.criteria_text?.trim();
      if (!title || !criteriaText) {
        results.push({ classId, title: title || "(제목 없음)", error: "제목 또는 채점기준이 비어 있습니다." });
        continue;
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .insert({
          class_id: classId,
          teacher_id: session.userId,
          title,
          subject: item.subject ?? null,
          scoring_type: item.scoring_type === "label" ? "label" : "numeric",
          status: "draft",
        })
        .select("id")
        .single();

      if (assignmentError || !assignment) {
        results.push({ classId, title, error: "과제 생성에 실패했습니다." });
        continue;
      }

      const { error: criteriaError } = await supabase
        .from("grading_criteria")
        .insert({ assignment_id: assignment.id, criteria_text: criteriaText, source_type: "text" });

      if (criteriaError) {
        results.push({ classId, title, assignmentId: assignment.id, error: "채점기준 저장에 실패했습니다." });
        continue;
      }

      results.push({ classId, title, assignmentId: assignment.id });
    }
  }

  const created = results.filter((r) => !r.error).length;
  const failed = results.length - created;

  return NextResponse.json({ created, failed, results });
}
