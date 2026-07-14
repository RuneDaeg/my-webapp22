"use client";

import { useActionState, useRef } from "react";
import { createTeacherAction, type CreateTeacherResult } from "@/app/admin/actions";

export function CreateTeacherForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: CreateTeacherResult | null, formData: FormData) => {
      const result = await createTeacherAction(prev, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <div className="space-y-3">
      <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              교사 이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="teacher@school.kr"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="displayName" className="text-sm font-medium text-gray-700">
              이름
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              placeholder="홍길동"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "생성 중..." : "교사 계정 생성"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state?.ok && (
        <div className="space-y-1 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">교사 계정이 생성됐습니다.</p>
          <p className="text-sm text-green-900">
            이메일: <span className="font-mono">{state.email}</span>
          </p>
          <p className="text-sm text-green-900">
            임시 비밀번호: <span className="font-mono font-semibold">{state.tempPassword}</span>
          </p>
          <p className="text-xs text-green-700">
            이 임시 비밀번호는 지금 한 번만 표시됩니다. 교사에게 전달하고, 교사는 첫 로그인 후 비밀번호를
            변경하도록 안내하세요.
          </p>
        </div>
      )}
    </div>
  );
}
