import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey, encryptApiKey, isEncrypted } from "./crypto";
import { AiError, DEFAULT_MODEL, type AiCredential, type AiProvider } from "./types";

// 교사가 본인 키를 아직 안 넣었을 때 던진다(키 필수 정책). 라우트에서 사용자에게 안내 메시지로 변환.
export class MissingCredentialError extends AiError {}

// [보안] 키는 service-role로만 읽고 여기서만 복호화한다 — 클라이언트로 절대 내려가지 않는다.
export async function getTeacherCredential(teacherId: string): Promise<AiCredential> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("teacher_ai_credentials")
    .select("provider, api_key, model")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!data?.api_key) {
    throw new MissingCredentialError(
      "AI API 키가 설정되지 않았습니다. 우측 상단 이름 → 계정 설정에서 본인 API 키를 등록해주세요.",
    );
  }

  const stored = data.api_key;
  const apiKey = decryptApiKey(stored);

  // 0016 이전에 평문으로 저장된 키는 처음 쓰이는 시점에 조용히 암호문으로 교체한다(교사 재등록 불필요).
  if (!isEncrypted(stored)) {
    await admin
      .from("teacher_ai_credentials")
      .update({ api_key: encryptApiKey(apiKey) })
      .eq("teacher_id", teacherId);
  }

  const provider = data.provider as AiProvider;
  return { provider, apiKey, model: data.model || DEFAULT_MODEL[provider] };
}

// /account 표시용: 키 값은 빼고 설정 여부/제공사/모델만.
export async function getTeacherCredentialStatus(
  teacherId: string,
): Promise<{ hasKey: boolean; provider: AiProvider | null; model: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("teacher_ai_credentials")
    .select("provider, api_key, model")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!data?.api_key) return { hasKey: false, provider: null, model: null };
  return { hasKey: true, provider: data.provider as AiProvider, model: data.model };
}
