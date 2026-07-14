"use client";

import { useState } from "react";
import { saveAttemptFeedbackAction } from "@/app/teacher/quiz-actions";

export function TeacherFeedbackForm({
  attemptId,
  classId,
  initialFeedback,
}: {
  attemptId: string;
  classId: string;
  initialFeedback: string | null;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSaving(true);
        try {
          await saveAttemptFeedbackAction(formData);
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-1"
    >
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="classId" value={classId} />
      <label className="text-xs font-medium text-blue-800">선생님 피드백</label>
      <textarea
        name="teacherFeedback"
        rows={2}
        defaultValue={initialFeedback ?? ""}
        placeholder="학생에게 남길 코멘트를 입력하세요"
        className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "저장 중..." : initialFeedback ? "피드백 수정" : "피드백 남기기"}
      </button>
    </form>
  );
}
