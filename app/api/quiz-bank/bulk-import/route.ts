import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestionType } from "@/lib/types/db";

export const runtime = "nodejs";

interface BulkImportItem {
  unit: string;
  type: QuizQuestionType;
  content: string;
  options?: string[] | null;
  answer: string;
  difficulty: number;
  concept_keyword?: string | null;
  page?: number | null;
  image_path?: string | null;
}

interface BulkImportBody {
  classId: string;
  items: BulkImportItem[];
}

interface ResultEntry {
  content: string;
  error?: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 문항을 일괄 등록할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as BulkImportBody | null;
  if (!body?.classId || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "classId와 문항 목록이 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS: 본인 소유 클래스만 조회됨
  const { data: classRow } = await supabase.from("classes").select("id").eq("id", body.classId).maybeSingle();
  if (!classRow) {
    return NextResponse.json({ error: "클래스를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 403 });
  }

  const results: ResultEntry[] = [];

  for (const item of body.items) {
    const content = item.content?.trim();
    const answer = item.answer?.trim();
    const unit = item.unit?.trim();
    if (!content || !answer || !unit) {
      results.push({ content: content || "(내용 없음)", error: "단원/문제/정답이 비어 있습니다." });
      continue;
    }

    // image_path는 본인이 업로드한 경로({본인 uid}/ 접두)만 허용 — 남의 그림 경로 주입 방지
    const imagePath =
      item.image_path && item.image_path.startsWith(`${session.userId}/`) ? item.image_path : null;

    const { error } = await supabase.from("quiz_questions").insert({
      class_id: body.classId,
      teacher_id: session.userId,
      unit,
      type: item.type === "subjective" ? "subjective" : "multiple",
      content,
      options: item.options && item.options.length > 0 ? item.options : null,
      answer,
      difficulty: Math.min(5, Math.max(1, Math.round(item.difficulty) || 3)),
      concept_keyword: item.concept_keyword?.trim() || null,
      status: "published",
      source_page: item.page ?? null,
      image_path: imagePath,
    });

    if (error) {
      results.push({ content, error: "문항 저장에 실패했습니다." });
      continue;
    }
    results.push({ content });
  }

  const created = results.filter((r) => !r.error).length;
  const failed = results.length - created;

  return NextResponse.json({ created, failed, results });
}
