"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/fetchJson";

interface ClassOption {
  id: string;
  name: string;
}

interface ParsedItem {
  title: string;
  subject: string | null;
  scoring_type: "numeric" | "label";
  related_standards: string;
  evaluation_elements: string;
  scoring_criteria: string;
  evaluation_method: string | null;
  notes: string | null;
  included: boolean;
}

interface BulkResultEntry {
  classId: string;
  title: string;
  assignmentId?: string;
  error?: string;
}

type Step = "upload" | "review" | "done";

// 검토 화면에서는 항목을 구분해서 보여주고, 실제 과제 생성 시에는 하나의 채점기준 텍스트로 합친다
// (AI 채점이 읽는 grading_criteria.criteria_text는 단일 텍스트 필드라 스키마 변경 없이 그대로 재사용).
// 값이 여러 줄이면 라벨을 별도 줄에 두어 가독성을 높이고, 섹션 사이는 빈 줄로 구분한다.
function section(label: string, value: string): string {
  const v = value.trim();
  return v.includes("\n") ? `■ ${label}\n${v}` : `■ ${label}: ${v}`;
}

function buildCriteriaText(item: ParsedItem): string {
  const sections = [
    section("관련 성취기준", item.related_standards),
    section("평가요소 및 배점", item.evaluation_elements),
    section("채점 기준", item.scoring_criteria),
  ];
  if (item.evaluation_method) sections.push(section("평가 방법", item.evaluation_method));
  if (item.notes) sections.push(section("유의점", item.notes));
  return sections.join("\n\n");
}

// AI가 별도 항목으로 잘못 나눈 경우(실제로는 학생이 파일 하나로 제출하는 경우) 교사가 직접 합칠 수 있게.
function mergeItems(itemsToMerge: ParsedItem[]): ParsedItem {
  const dedupJoin = (values: (string | null | undefined)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim())))).join("\n");

  return {
    title: itemsToMerge.map((i) => i.title).join(" · "),
    subject: itemsToMerge.find((i) => i.subject)?.subject ?? null,
    scoring_type: itemsToMerge.some((i) => i.scoring_type === "numeric") ? "numeric" : "label",
    related_standards: dedupJoin(itemsToMerge.map((i) => i.related_standards)),
    evaluation_elements: itemsToMerge.map((i, idx) => `${idx + 1}. ${i.title}: ${i.evaluation_elements}`).join("\n"),
    scoring_criteria: itemsToMerge.map((i, idx) => `${idx + 1}. ${i.title}\n${i.scoring_criteria}`).join("\n\n"),
    evaluation_method: dedupJoin(itemsToMerge.map((i) => i.evaluation_method)) || null,
    notes: dedupJoin(itemsToMerge.map((i) => i.notes)) || null,
    included: true,
  };
}

export function PlanImportWizard({ classes }: { classes: ClassOption[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [mergeSelected, setMergeSelected] = useState<Set<number>>(new Set());
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ created: number; failed: number; results: BulkResultEntry[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAnalyze() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/evaluation-plan/extract", { method: "POST", body: formData });
      const data = await parseJsonResponse<{ items?: unknown[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했습니다.");

      setItems(
        (data.items as Omit<ParsedItem, "included">[]).map((item) => ({ ...item, included: true })),
      );
      setMergeSelected(new Set());
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(index: number, patch: Partial<ParsedItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function toggleMergeSelect(index: number) {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleMergeSelected() {
    if (mergeSelected.size < 2) return;

    const merged = mergeItems(items.filter((_, i) => mergeSelected.has(i)));

    setItems((prev) => {
      const result: ParsedItem[] = [];
      let inserted = false;
      prev.forEach((item, i) => {
        if (mergeSelected.has(i)) {
          if (!inserted) {
            result.push(merged);
            inserted = true;
          }
        } else {
          result.push(item);
        }
      });
      return result;
    });
    setMergeSelected(new Set());
  }

  function toggleClass(id: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkCreate() {
    const includedItems = items.filter((item) => item.included);
    if (selectedClassIds.size === 0) {
      setError("적용할 클래스를 하나 이상 선택해주세요.");
      return;
    }
    if (includedItems.length === 0) {
      setError("생성할 항목을 하나 이상 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/assignments/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classIds: Array.from(selectedClassIds),
          items: includedItems.map((item) => ({
            title: item.title,
            subject: item.subject,
            scoring_type: item.scoring_type,
            criteria_text: buildCriteriaText(item),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "일괄 생성에 실패했습니다.");

      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "upload") {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          학기 평가계획 문서를 업로드하면 AI가 수행평가 활동들을 찾아 항목별로 분리하고, 각 활동의 채점
          기준을 정리해드립니다. 표/배점 레이아웃이 정확히 인식되도록 <strong>pdf 업로드를 권장</strong>합니다
          (docx/hwpx/txt는 텍스트만 추출해 분석하므로 정확도가 떨어질 수 있습니다).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.hwpx,.txt"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {analyzing ? "분석 중... (1분 정도 걸릴 수 있어요)" : "분석하기"}
        </button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-5">
        <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">적용할 클래스</h2>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <label
                key={c.id}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                  selectedClassIds.has(c.id)
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedClassIds.has(c.id)}
                  onChange={() => toggleClass(c.id)}
                  className="sr-only"
                />
                {c.name}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">발견된 수행평가 항목 ({items.length}개)</h2>
            {mergeSelected.size >= 2 && (
              <button
                onClick={handleMergeSelected}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                선택한 {mergeSelected.size}개 항목 합치기
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            같은 파일 하나로 제출되는 항목인데 AI가 여러 개로 나눴다면, 아래 &quot;합칠 항목&quot;을 체크하고
            &quot;합치기&quot; 버튼을 누르세요.
          </p>
          {items.map((item, index) => (
            <div
              key={index}
              className={`space-y-2 rounded-lg border bg-white p-4 ${
                mergeSelected.has(index) ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateItem(index, { included: e.target.checked })}
                  />
                  포함
                </label>
                <label className="flex items-center gap-2 text-sm text-blue-700">
                  <input
                    type="checkbox"
                    checked={mergeSelected.has(index)}
                    onChange={() => toggleMergeSelect(index)}
                  />
                  합칠 항목
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-500">제목</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">과목</label>
                  <input
                    type="text"
                    value={item.subject ?? ""}
                    onChange={(e) => updateItem(index, { subject: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">관련 성취기준</label>
                <textarea
                  rows={2}
                  value={item.related_standards}
                  onChange={(e) => updateItem(index, { related_standards: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">평가요소 및 배점</label>
                <textarea
                  rows={2}
                  value={item.evaluation_elements}
                  onChange={(e) => updateItem(index, { evaluation_elements: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">채점 기준 (항목별로 줄바꿈해 정리됨)</label>
                <textarea
                  rows={8}
                  value={item.scoring_criteria}
                  onChange={(e) => updateItem(index, { scoring_criteria: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">평가 방법 (선택)</label>
                <input
                  type="text"
                  value={item.evaluation_method ?? ""}
                  onChange={(e) => updateItem(index, { evaluation_method: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">유의점 (선택)</label>
                <textarea
                  rows={3}
                  value={item.notes ?? ""}
                  onChange={(e) => updateItem(index, { notes: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => setStep("upload")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            다시 업로드
          </button>
          <button
            onClick={handleBulkCreate}
            disabled={submitting}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "생성 중..." : "일괄 생성"}
          </button>
        </div>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-700">
        <span className="font-semibold text-green-700">{result?.created ?? 0}개</span> 과제가 생성됐습니다
        {result && result.failed > 0 ? ` (실패 ${result.failed}개)` : ""}. 생성된 과제는 임시저장(draft)
        상태라 학생에게는 아직 보이지 않습니다 — 각 클래스에서 마감일을 확인한 뒤 &quot;다시 열기&quot;를
        눌러 공개해주세요.
      </p>
      {result && result.failed > 0 && (
        <ul className="space-y-1 text-sm text-red-600">
          {result.results
            .filter((r) => r.error)
            .map((r, i) => (
              <li key={i}>
                {r.title}: {r.error}
              </li>
            ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {Array.from(selectedClassIds).map((classId) => {
          const cls = classes.find((c) => c.id === classId);
          return (
            <Link
              key={classId}
              href={`/teacher/classes/${classId}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {cls?.name ?? "클래스"} 보러가기
            </Link>
          );
        })}
      </div>
    </div>
  );
}
