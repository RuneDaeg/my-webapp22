"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/fetchJson";
import { MathText } from "@/components/MathText";

// 클래스 통과율 기반 AI 분석. 서버의 signature 캐시 덕분에 집계가 그대로면 새로고침해도 같은 텍스트가 나온다.
export function ClassAnalysisNarrative({ classId }: { classId: string }) {
  const [state, setState] = useState<"loading" | "done" | "empty" | "error">("loading");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/quiz/class-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId }),
        });
        const d = await parseJsonResponse<{ analysis?: string | null; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setError(d.error ?? "분석을 불러오지 못했습니다.");
          setState("error");
          return;
        }
        if (!d.analysis) {
          setState("empty");
          return;
        }
        setAnalysis(d.analysis);
        setState("done");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (state === "loading")
    return <p className="text-sm text-gray-400">AI가 통과율을 분석하는 중... (최대 1분)</p>;
  if (state === "empty")
    return <p className="text-sm text-gray-500">아직 학생이 푼 문제가 없어 분석할 데이터가 없습니다.</p>;
  if (state === "error") return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <MathText text={analysis ?? ""} className="block whitespace-pre-wrap text-sm text-purple-900" />
    </div>
  );
}
