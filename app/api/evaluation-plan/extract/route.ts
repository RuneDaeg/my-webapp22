import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { extractText, ExtractionError } from "@/lib/extraction";
import { extractEvaluationPlan } from "@/lib/gemini/planExtraction";
import { GradingError } from "@/lib/gemini/grade";
import { getTeacherCredential, MissingCredentialError } from "@/lib/ai/credential";
import { validateUploadedFile, FileValidationError } from "@/lib/validation/fileValidation";

export const runtime = "nodejs";
// 긴 평가계획 문서는 Gemini 응답 생성이 기본 제한(약 15초)보다 오래 걸려 504로 끊길 수 있어 연장.
export const maxDuration = 120;

// 주의: Vercel Node 서버리스 함수는 기본 요청 본문 제한이 4.5MB다. fileValidation의 20MB
// 한도보다 낮으므로, 이 라우트로 큰 PDF(스캔 이미지가 많은 문서 등)를 보내면 앱 검증 이전에
// 플랫폼 단에서 요청이 거부될 수 있다 — 기존 제출/채점기준 업로드 라우트에도 잠재된 동일한
// 제약이며, 이번 기능 범위에서는 별도 조치 없이 알려진 한계로 남겨둔다.

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.profile.role !== "teacher") {
    return NextResponse.json({ error: "교사만 평가계획을 분석할 수 있습니다." }, { status: 403 });
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  try {
    const cred = await getTeacherCredential(session.profile.id);
    const items =
      ext === "pdf"
        ? await extractEvaluationPlan(cred, { pdfBuffer: buffer })
        : await extractEvaluationPlan(cred, { planText: await extractText(buffer, file.name, file.type) });

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof GradingError ? err.message : "평가계획 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
