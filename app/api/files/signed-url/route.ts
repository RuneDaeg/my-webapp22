import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// 교사가 학생 제출 파일의 원본을 열람하기 위한 signed URL 발급.
// storage RLS는 소유자(학생) 폴더 기준이라 교사는 여기서 소유권을 DB로 검증한 뒤
// service-role로 signed URL을 만든다.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 제출 파일을 열람할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
  if (!submissionId) return NextResponse.json({ error: "submissionId가 필요합니다." }, { status: 400 });

  const supabase = await createClient();

  // RLS: 교사 본인 소유 과제의 제출물만 조회됨
  const { data: submission } = await supabase
    .from("submissions")
    .select("file_path")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "제출물을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { data, error } = await createAdminClient()
    .storage.from("submission-files")
    .createSignedUrl(submission.file_path, 120);

  if (error || !data) return NextResponse.json({ error: "링크 생성에 실패했습니다." }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}
