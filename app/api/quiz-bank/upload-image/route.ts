import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 위저드 크롭/문항 폼에서 올리는 문항 그림 하나를 quiz-images 버킷에 저장하고 경로를 돌려준다.
// 문항 생성 전에 업로드되므로 question_id가 아니라 {teacher}/{class} 경로에 저장한다.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 그림을 업로드할 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const classId = String(formData?.get("classId") ?? "");

  if (!(file instanceof File) || !classId) {
    return NextResponse.json({ error: "file과 classId가 필요합니다." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "그림은 5MB 이하여야 합니다." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS: 본인 소유 클래스만 조회됨
  const { data: classRow } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (!classRow) {
    return NextResponse.json({ error: "클래스를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 403 });
  }

  const ext = file.type === "image/jpeg" ? "jpg" : "png";
  const path = `${session.userId}/${classId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("quiz-images")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    console.error("quiz image upload failed:", uploadError.message);
    return NextResponse.json({ error: "그림 업로드에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ path });
}
