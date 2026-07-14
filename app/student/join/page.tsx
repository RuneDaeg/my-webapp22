"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function JoinClassPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "참여에 실패했습니다.");

      setSuccess(`"${data.class.name}" 클래스에 참여했습니다.`);
      setCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">클래스 참여</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="code" className="text-sm font-medium text-gray-700">
            선생님께 받은 참여 코드
          </label>
          <input
            id="code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: AB3D9K"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-center font-mono text-lg tracking-widest focus:border-gray-900 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "참여 중..." : "참여하기"}
        </button>
      </form>
    </div>
  );
}
