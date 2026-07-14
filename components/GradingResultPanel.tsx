"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/fetchJson";

interface GradingResultData {
  id: string;
  score: number | null;
  score_label: string | null;
  ai_feedback: string | null;
  ai_septeuk: string | null;
  ai_rationale: string | null;
  final_score: number | null;
  final_feedback: string | null;
  final_septeuk: string | null;
  status: string;
  visible_to_student: boolean;
}

interface GradingResultPanelProps {
  submissionId: string;
  scoringType: "numeric" | "label";
  initialResult: GradingResultData | null;
}

export function GradingResultPanel({ submissionId, scoringType, initialResult }: GradingResultPanelProps) {
  const [result, setResult] = useState<GradingResultData | null>(initialResult);
  const [score, setScore] = useState<string>(
    String(initialResult?.final_score ?? initialResult?.score ?? initialResult?.score_label ?? ""),
  );
  const [feedback, setFeedback] = useState(initialResult?.final_feedback ?? initialResult?.ai_feedback ?? "");
  const [septeuk, setSepteuk] = useState(initialResult?.final_septeuk ?? initialResult?.ai_septeuk ?? "");
  const [grading, setGrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGrading() {
    setGrading(true);
    setError(null);
    try {
      const res = await fetch(`/api/grading/${submissionId}`, { method: "POST" });
      const data = await parseJsonResponse<{ result?: GradingResultData; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "채점에 실패했습니다.");
      const r = data.result as GradingResultData;
      setResult(r);
      setScore(String(r.final_score ?? r.score ?? r.score_label ?? ""));
      setFeedback(r.final_feedback ?? r.ai_feedback ?? "");
      setSepteuk(r.final_septeuk ?? r.ai_septeuk ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점 중 오류가 발생했습니다.");
    } finally {
      setGrading(false);
    }
  }

  async function save(publish: boolean) {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        final_feedback: feedback,
        final_septeuk: septeuk,
      };
      if (scoringType === "numeric") {
        body.final_score = score ? Number(score) : null;
      } else {
        body.final_score = null;
      }
      if (publish) body.visible_to_student = true;

      const res = await fetch(`/api/grading-results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했습니다.");
      setResult(data.result as GradingResultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">AI 채점</h2>
        <button
          onClick={runGrading}
          disabled={grading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {grading ? "채점 중..." : result ? "다시 채점" : "AI 채점 실행"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!result && !grading && (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          아직 채점되지 않았습니다. &quot;AI 채점 실행&quot;을 눌러 초안을 생성하세요.
        </p>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          {result.visible_to_student && (
            <p className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              현재 학생에게 점수/피드백이 공개되어 있습니다.
            </p>
          )}

          {scoringType === "numeric" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">점수</label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-32 rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              AI 평가: <span className="font-medium text-gray-900">{result.score_label ?? "-"}</span>
            </p>
          )}

          {result.ai_rationale && (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">AI 채점 근거 (교사 전용, 학생에게 공개되지 않음)</p>
              <p className="whitespace-pre-wrap text-sm text-amber-900">{result.ai_rationale}</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">학생 피드백</label>
            <textarea
              rows={5}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                세부능력 및 특기사항 초안 (교사 전용, 학생에게 공개되지 않음)
              </label>
              <span className="text-xs text-gray-400">{septeuk.length}자</span>
            </div>
            <textarea
              rows={6}
              value={septeuk}
              onChange={(e) => setSepteuk(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              임시 저장
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장 및 학생에게 공개"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
