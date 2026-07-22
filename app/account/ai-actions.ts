"use server";

import { getSession } from "@/lib/auth/getSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { runText } from "@/lib/ai";
import { DEFAULT_MODEL, type AiProvider } from "@/lib/ai/types";

const PROVIDERS: AiProvider[] = ["gemini", "openai", "anthropic"];

interface ActionResult {
  ok: boolean;
  message: string;
}

// 교사가 입력한 키/모델을 저장하기 전에, 실제로 호출이 되는지 아주 짧은 테스트 요청으로 검증한다.
// 잘못된 키·오타·존재하지 않는 모델을 미리 걸러 학생 채점 중에 실패하는 상황을 막는다.
export async function saveAiCredentialAction(
  provider: string,
  apiKey: string,
  model: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "로그인이 필요합니다." };
  if (session.profile.role !== "teacher") {
    return { ok: false, message: "교사만 AI 키를 등록할 수 있습니다." };
  }

  if (!PROVIDERS.includes(provider as AiProvider)) {
    return { ok: false, message: "지원하지 않는 제공사입니다." };
  }
  const prov = provider as AiProvider;
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "API 키를 입력해주세요." };
  const modelName = model.trim() || DEFAULT_MODEL[prov];

  // 검증용 최소 호출 — 아주 짧은 응답만 요청한다.
  try {
    await runText(
      { provider: prov, apiKey: key, model: modelName },
      { parts: [{ text: "다음 한 단어로만 답하세요: 확인" }], maxOutputTokens: 16, thinkingBudget: 0 },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `키 검증에 실패했습니다. 키·모델명을 확인해주세요. (${detail.slice(0, 160)})`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("teacher_ai_credentials").upsert(
    {
      teacher_id: session.profile.id,
      provider: prov,
      api_key: key,
      model: modelName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "teacher_id" },
  );

  if (error) return { ok: false, message: "저장 중 오류가 발생했습니다." };
  return { ok: true, message: `${modelName} 키가 저장되었습니다.` };
}

export async function clearAiCredentialAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "로그인이 필요합니다." };
  if (session.profile.role !== "teacher") {
    return { ok: false, message: "교사만 이용할 수 있습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_ai_credentials")
    .delete()
    .eq("teacher_id", session.profile.id);

  if (error) return { ok: false, message: "삭제 중 오류가 발생했습니다." };
  return { ok: true, message: "저장된 키를 삭제했습니다." };
}
