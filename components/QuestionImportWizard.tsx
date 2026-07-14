"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/fetchJson";
import { PdfFigureCropper } from "@/components/PdfFigureCropper";
import { MathText } from "@/components/MathText";

interface ParsedItem {
  unit: string;
  type: "multiple" | "subjective";
  content: string;
  optionsText: string; // 편집용: 한 줄에 하나씩
  answer: string;
  difficulty: number;
  concept_keyword: string | null;
  page: number | null;
  included: boolean;
  image_path: string | null;
  imagePreviewUrl: string | null; // 크롭 직후 로컬 미리보기 (object URL)
}

interface ResultEntry {
  content: string;
  error?: string;
}

type Step = "upload" | "review" | "done";

export function QuestionImportWizard({ classId }: { classId: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [result, setResult] = useState<{ created: number; failed: number; results: ResultEntry[] } | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null); // 크롭용으로 검토 단계까지 들고 있는 원본
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAnalyze() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("PDF 파일을 선택해주세요.");
      return;
    }
    if (!defaultUnit.trim()) {
      setError("단원을 입력해주세요.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/quiz-bank/extract", { method: "POST", body: formData });
      const data = await parseJsonResponse<{ items?: unknown[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했습니다.");

      const parsedItems = data.items as Array<{
        type: "multiple" | "subjective";
        content: string;
        options?: string[] | null;
        answer: string;
        difficulty: number;
        concept_keyword?: string | null;
        page?: number | null;
      }>;

      setItems(
        parsedItems.map((item) => ({
          unit: defaultUnit.trim(),
          type: item.type,
          content: item.content,
          optionsText: (item.options ?? []).join("\n"),
          answer: item.answer,
          difficulty: item.difficulty,
          concept_keyword: item.concept_keyword ?? null,
          page: item.page ?? null,
          included: true,
          image_path: null,
          imagePreviewUrl: null,
        })),
      );
      setPdfFile(file);
      setCropTargetIndex(null);
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

  async function handleCropped(index: number, blob: Blob) {
    const formData = new FormData();
    formData.append("file", new File([blob], "figure.png", { type: "image/png" }));
    formData.append("classId", classId);

    const res = await fetch("/api/quiz-bank/upload-image", { method: "POST", body: formData });
    const data = await parseJsonResponse<{ path?: string; error?: string }>(res);
    if (!res.ok || !data.path) throw new Error(data.error ?? "그림 업로드에 실패했습니다.");

    updateItem(index, { image_path: data.path, imagePreviewUrl: URL.createObjectURL(blob) });
    setCropTargetIndex(null);
  }

  async function handleBulkCreate() {
    const includedItems = items.filter((item) => item.included);
    if (includedItems.length === 0) {
      setError("생성할 문항을 하나 이상 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz-bank/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          items: includedItems.map((item) => ({
            unit: item.unit,
            type: item.type,
            content: item.content,
            options: item.optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            answer: item.answer,
            difficulty: item.difficulty,
            concept_keyword: item.concept_keyword,
            page: item.page,
            image_path: item.image_path,
          })),
        }),
      });
      const data = await parseJsonResponse<{ created: number; failed: number; results: ResultEntry[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "일괄 등록에 실패했습니다.");

      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "upload") {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          문제지 PDF를 업로드하면 AI가 문항을 하나씩 찾아 유형/보기/정답/난이도를 자동으로 채워드립니다.
          업로드 후 검토 화면에서 내용을 확인·수정할 수 있습니다.
        </p>
        <div className="space-y-1">
          <label htmlFor="defaultUnit" className="text-sm font-medium text-gray-700">
            단원 (이 PDF의 모든 문항에 공통 적용, 검토 화면에서 개별 수정 가능)
          </label>
          <input
            id="defaultUnit"
            type="text"
            value={defaultUnit}
            onChange={(e) => setDefaultUnit(e.target.value)}
            placeholder="예: 역학적 상호작용"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              발견된 문항 ({items.length}개 중 {items.filter((i) => i.included).length}개 선택)
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={items.length > 0 && items.every((i) => i.included)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setItems((prev) => prev.map((i) => ({ ...i, included: checked })));
                }}
              />
              전체 선택/해제
            </label>
          </div>
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateItem(index, { included: e.target.checked })}
                  />
                  포함
                </label>
                <span className="text-xs text-gray-400">
                  {item.page ? `PDF ${item.page}쪽` : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">단원</label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateItem(index, { unit: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">유형</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(index, { type: e.target.value as "multiple" | "subjective" })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  >
                    <option value="multiple">객관식</option>
                    <option value="subjective">서술형</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">난이도 (1~5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={item.difficulty}
                    onChange={(e) => updateItem(index, { difficulty: Number(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">
                  문제 내용 ($...$ 안에 LaTeX 수식 사용 가능)
                </label>
                <textarea
                  rows={4}
                  value={item.content}
                  onChange={(e) => updateItem(index, { content: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
                {item.content.includes("$") && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">미리보기</p>
                    <MathText text={item.content} className="block whitespace-pre-wrap text-sm text-gray-900" />
                  </div>
                )}
              </div>
              {item.type === "multiple" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">보기 (한 줄에 하나씩)</label>
                  <textarea
                    rows={4}
                    value={item.optionsText}
                    onChange={(e) => updateItem(index, { optionsText: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                  {item.optionsText.includes("$") && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                      <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">미리보기</p>
                      {item.optionsText
                        .split("\n")
                        .filter((s) => s.trim())
                        .map((opt, i) => (
                          <MathText key={i} text={`${i + 1}. ${opt}`} className="block text-sm text-gray-900" />
                        ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">
                  {item.type === "multiple" ? "정답 (보기 중 하나와 동일한 텍스트)" : "모범답안"}
                </label>
                <textarea
                  rows={item.type === "multiple" ? 1 : 2}
                  value={item.answer}
                  onChange={(e) => updateItem(index, { answer: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">핵심 개념 키워드 (선택)</label>
                <input
                  type="text"
                  value={item.concept_keyword ?? ""}
                  onChange={(e) => updateItem(index, { concept_keyword: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">그림 (선택)</span>
                  <div className="flex gap-2">
                    {item.image_path && (
                      <button
                        type="button"
                        onClick={() => updateItem(index, { image_path: null, imagePreviewUrl: null })}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        그림 삭제
                      </button>
                    )}
                    {pdfFile && cropTargetIndex !== index && (
                      <button
                        type="button"
                        onClick={() => setCropTargetIndex(index)}
                        className="rounded-md border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      >
                        PDF에서 그림 자르기
                      </button>
                    )}
                  </div>
                </div>
                {item.imagePreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imagePreviewUrl}
                    alt="첨부된 그림"
                    className="max-h-48 rounded border border-gray-200"
                  />
                )}
                {pdfFile && cropTargetIndex === index && (
                  <PdfFigureCropper
                    file={pdfFile}
                    initialPage={item.page ?? 1}
                    onCropped={(blob) => handleCropped(index, blob)}
                    onClose={() => setCropTargetIndex(null)}
                  />
                )}
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
            {submitting ? "등록 중..." : "일괄 등록"}
          </button>
        </div>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-700">
        <span className="font-semibold text-green-700">{result?.created ?? 0}개</span> 문항이 등록됐습니다
        {result && result.failed > 0 ? ` (실패 ${result.failed}개)` : ""}.
      </p>
      {result && result.failed > 0 && (
        <ul className="space-y-1 text-sm text-red-600">
          {result.results
            .filter((r) => r.error)
            .map((r, i) => (
              <li key={i}>
                {r.content}: {r.error}
              </li>
            ))}
        </ul>
      )}
      <Link
        href={`/teacher/classes/${classId}/quiz-bank`}
        className="inline-block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        문제은행 보러가기
      </Link>
    </div>
  );
}
