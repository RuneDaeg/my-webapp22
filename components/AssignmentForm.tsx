"use client";

import { useState } from "react";

interface ClassOption {
  id: string;
  name: string;
}

interface AssignmentFormProps {
  classes: ClassOption[];
  defaultClassId?: string;
  action: (formData: FormData) => void | Promise<void>;
}

export function AssignmentForm({ classes, defaultClassId, action }: AssignmentFormProps) {
  const [sourceType, setSourceType] = useState<"text" | "file">("text");
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      onSubmit={() => setPending(true)}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-1">
        <label htmlFor="classId" className="text-sm font-medium text-gray-700">
          클래스
        </label>
        <select
          id="classId"
          name="classId"
          required
          defaultValue={defaultClassId}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="" disabled>
            클래스를 선택하세요
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium text-gray-700">
          과제 제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="subject" className="text-sm font-medium text-gray-700">
            과목
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            placeholder="예: 국어"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="dueAt" className="text-sm font-medium text-gray-700">
            마감일
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          과제 설명 (학생에게 표시됨)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium text-gray-700">채점 방식</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scoringType" value="label" defaultChecked /> 정성 평가 (상/중/하)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scoringType" value="numeric" /> 숫자 점수
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-200 pt-4">
        <span className="text-sm font-medium text-gray-700">채점 기준</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType("text")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              sourceType === "text" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            텍스트 입력
          </button>
          <button
            type="button"
            onClick={() => setSourceType("file")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              sourceType === "file" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            파일 업로드
          </button>
        </div>
        <input type="hidden" name="sourceType" value={sourceType} />

        {sourceType === "text" ? (
          <textarea
            name="criteriaText"
            rows={6}
            placeholder="채점 기준을 입력하세요. 항목별 배점/평가 요소를 구체적으로 적을수록 AI 채점 품질이 좋아집니다."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
          />
        ) : (
          <input
            type="file"
            name="criteriaFile"
            accept=".pdf,.docx,.hwpx,.txt"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white"
          />
        )}
        <p className="text-xs text-gray-400">pdf, docx, hwpx, txt 파일 지원 (최대 20MB)</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "생성 중..." : "과제 만들기"}
      </button>
    </form>
  );
}
