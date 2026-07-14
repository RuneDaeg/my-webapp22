"use client";

import { useState } from "react";
import type { QuizQuestionType } from "@/lib/types/db";
import { MathText } from "@/components/MathText";

interface QuestionFormProps {
  classId: string;
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: {
    questionId?: string;
    unit?: string;
    type?: QuizQuestionType;
    content?: string;
    options?: string[] | null;
    answer?: string;
    difficulty?: number;
    conceptKeyword?: string | null;
  };
  currentImageUrl?: string | null; // 수정 화면에서 기존 첨부 그림 미리보기 (signed URL)
  submitLabel?: string;
}

export function QuestionForm({
  classId,
  action,
  defaultValues,
  currentImageUrl,
  submitLabel = "문항 저장",
}: QuestionFormProps) {
  const [type, setType] = useState<QuizQuestionType>(defaultValues?.type ?? "multiple");
  const [content, setContent] = useState(defaultValues?.content ?? "");
  const [optionsText, setOptionsText] = useState(defaultValues?.options?.join("\n") ?? "");
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      onSubmit={() => setPending(true)}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="classId" value={classId} />
      {defaultValues?.questionId && <input type="hidden" name="questionId" value={defaultValues.questionId} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="unit" className="text-sm font-medium text-gray-700">
            단원
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            required
            defaultValue={defaultValues?.unit}
            placeholder="예: 역학적 상호작용"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="difficulty" className="text-sm font-medium text-gray-700">
            난이도 (1~5)
          </label>
          <input
            id="difficulty"
            name="difficulty"
            type="number"
            min={1}
            max={5}
            required
            defaultValue={defaultValues?.difficulty ?? 3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium text-gray-700">유형</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="type"
              value="multiple"
              checked={type === "multiple"}
              onChange={() => setType("multiple")}
            />{" "}
            객관식
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="type"
              value="subjective"
              checked={type === "subjective"}
              onChange={() => setType("subjective")}
            />{" "}
            서술형
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="content" className="text-sm font-medium text-gray-700">
          문제 내용 <span className="font-normal text-gray-400">($...$ 안에 LaTeX 수식 사용 가능, 예: $F=ma$)</span>
        </label>
        <textarea
          id="content"
          name="content"
          rows={4}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
        {content.includes("$") && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
            <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">미리보기</p>
            <MathText text={content} className="block whitespace-pre-wrap text-sm text-gray-900" />
          </div>
        )}
      </div>

      {type === "multiple" && (
        <div className="space-y-1">
          <label htmlFor="options" className="text-sm font-medium text-gray-700">
            보기 (한 줄에 하나씩)
          </label>
          <textarea
            id="options"
            name="options"
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={"보기1\n보기2\n보기3\n보기4"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
          {optionsText.includes("$") && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">미리보기</p>
              {optionsText
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
        <label htmlFor="answer" className="text-sm font-medium text-gray-700">
          {type === "multiple" ? "정답 (위 보기 중 하나와 정확히 같은 텍스트)" : "모범답안"}
        </label>
        <textarea
          id="answer"
          name="answer"
          rows={type === "multiple" ? 1 : 3}
          required
          defaultValue={defaultValues?.answer}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="conceptKeyword" className="text-sm font-medium text-gray-700">
          핵심 개념 키워드 (선택, 적응형 출제에 사용됨)
        </label>
        <input
          id="conceptKeyword"
          name="conceptKeyword"
          type="text"
          placeholder="예: 뉴턴 제2법칙"
          defaultValue={defaultValues?.conceptKeyword ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="imageFile" className="text-sm font-medium text-gray-700">
          그림 (선택)
        </label>
        {currentImageUrl && (
          <div className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImageUrl} alt="현재 첨부된 그림" className="max-h-48 rounded border border-gray-200" />
            <label className="flex items-center gap-2 text-sm text-red-600">
              <input type="checkbox" name="removeImage" value="1" /> 기존 그림 삭제
            </label>
          </div>
        )}
        <input
          id="imageFile"
          name="imageFile"
          type="file"
          accept="image/*"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white"
        />
        <p className="text-xs text-gray-400">
          png/jpg 등 이미지 파일, 최대 5MB. {currentImageUrl ? "새 파일을 올리면 기존 그림을 대체합니다." : ""}
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
