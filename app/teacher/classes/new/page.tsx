import { createClassAction } from "@/app/teacher/actions";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">클래스 만들기</h1>
      <form action={createClassAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            클래스 이름
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="예: 3학년 2반 국어"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          만들기
        </button>
      </form>
    </div>
  );
}
