"use client";

import { useState } from "react";
import { saveStudentFeedbackAction } from "@/app/teacher/quiz-actions";

export function StudentOverallFeedbackForm({
  classId,
  studentId,
  initialFeedback,
}: {
  classId: string;
  studentId: string;
  initialFeedback: string | null;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSaving(true);
        try {
          await saveStudentFeedbackAction(formData);
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-1"
    >
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      <label className="text-xs font-medium text-indigo-800">이 학생 종합 피드백 (총평)</label>
      <textarea
        name="studentFeedback"
        rows={3}
        defaultValue={initialFeedback ?? ""}
        placeholder="이 학생의 전반적인 학습 상태나 조언을 남기세요"
        className="w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "저장 중..." : initialFeedback ? "종합 피드백 수정" : "종합 피드백 남기기"}
      </button>
    </form>
  );
}
