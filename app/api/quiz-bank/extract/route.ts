import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { extractQuestionsFromPdf } from "@/lib/gemini/questionExtraction";
import { GradingError } from "@/lib/gemini/grade";
import { validateUploadedFile, FileValidationError } from "@/lib/validation/fileValidation";

export const runtime = "nodejs";
// 문항 수가 많은 문제지는 Gemini 응답 생성이 기본 제한(약 15초)보다 오래 걸려 504로 끊길 수 있어 연장.
export const maxDuration = 120;

// 주의: Vercel Node 서버리스 함수는 기본 요청 본문 제한이 4.5MB다 — 큰 문제지 PDF는 플랫폼 단에서
// 거부될 수 있는 알려진 한계 (evaluation-plan/extract 라우트와 동일).

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 문항을 분석할 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file이 필요합니다." }, { status: 400 });
  }

  try {
    validateUploadedFile(file);
  } catch (err) {
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "문항 추출은 PDF 파일만 지원합니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const items = await extractQuestionsFromPdf(buffer);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof GradingError ? err.message : "문항 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
