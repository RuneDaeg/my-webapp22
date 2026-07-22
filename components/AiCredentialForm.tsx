"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveAiCredentialAction, clearAiCredentialAction } from "@/app/account/ai-actions";
import { DEFAULT_MODEL, KEY_HINT, PROVIDER_LABEL, type AiProvider } from "@/lib/ai/types";

const PROVIDERS: AiProvider[] = ["gemini", "openai", "anthropic"];

interface Props {
  hasKey: boolean;
  provider: AiProvider | null;
  model: string | null;
}

export function AiCredentialForm({ hasKey, provider, model }: Props) {
  const router = useRouter();
  const [selProvider, setSelProvider] = useState<AiProvider>(provider ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(model ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!apiKey.trim()) {
      setMsg({ type: "err", text: "API 키를 입력해주세요." });
      return;
    }
    setBusy(true);
    // 키 검증(실제 호출)까지 하므로 몇 초 걸릴 수 있다.
    const res = await saveAiCredentialAction(selProvider, apiKey, modelName);
    setBusy(false);
    setMsg({ type: res.ok ? "ok" : "err", text: res.message });
    if (res.ok) {
      setApiKey("");
      router.refresh();
    }
  }

  async function handleClear() {
    if (!confirm("저장된 API 키를 삭제할까요? 삭제하면 AI 채점·분석 기능을 쓸 수 없습니다.")) return;
    setBusy(true);
    setMsg(null);
    const res = await clearAiCredentialAction();
    setBusy(false);
    setMsg({ type: res.ok ? "ok" : "err", text: res.message });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
          hasKey ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
        }`}
      >
        {hasKey ? (
          <>
            설정됨 · {provider ? PROVIDER_LABEL[provider] : ""} · {model}
          </>
        ) : (
          <>미설정 — AI 채점·분석을 쓰려면 키가 필요합니다</>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="ai-provider" className="text-sm font-medium text-gray-700">
          제공사
        </label>
        <select
          id="ai-provider"
          value={selProvider}
          onChange={(e) => {
            setSelProvider(e.target.value as AiProvider);
            setModelName("");
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="ai-key" className="text-sm font-medium text-gray-700">
          API 키
        </label>
        <input
          id="ai-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? "새 키로 교체하려면 입력 (그대로 두면 유지)" : KEY_HINT[selProvider]}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
        <p className="text-xs text-gray-400">{KEY_HINT[selProvider]}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="ai-model" className="text-sm font-medium text-gray-700">
          모델 (비워두면 기본값)
        </label>
        <input
          id="ai-model"
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder={DEFAULT_MODEL[selProvider]}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </div>

      {msg && <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "확인 중..." : "저장 및 키 검증"}
        </button>
        {hasKey && (
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            키 삭제
          </button>
        )}
      </div>
    </form>
  );
}
