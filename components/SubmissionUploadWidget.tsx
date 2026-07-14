"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SubmissionUploadWidget({
  assignmentId,
  currentFilename,
}: {
  assignmentId: string;
  currentFilename: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("assignmentId", assignmentId);
    formData.append("file", file);

    try {
      const res = await fetch("/api/submissions/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드에 실패했습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      {currentFilename && (
        <p className="text-sm text-gray-600">
          현재 제출 파일: <span className="font-medium text-gray-900">{currentFilename}</span>
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.hwpx,.txt"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white"
      />
      <p className="text-xs text-gray-400">pdf, docx, hwpx, txt 파일 지원 (최대 20MB)</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "업로드 중..." : currentFilename ? "다시 제출" : "제출하기"}
      </button>
    </form>
  );
}
