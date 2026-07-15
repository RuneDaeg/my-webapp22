"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudentQuizQuestion } from "@/lib/types/db";
import { parseJsonResponse } from "@/lib/fetchJson";
import { MathText } from "@/components/MathText";

// 정답(answer)이 없는 타입 — 클라이언트로는 정답이 내려오지 않는다.
type QuizQuestionWithImage = StudentQuizQuestion & { imageUrl?: string | null };

interface AnswerResult {
  isCorrect: boolean;
  feedback: string;
  nextDifficulty: number;
  nextQuestion: QuizQuestionWithImage | null;
  conceptExplanation: string | null;
}

type Phase = "loading" | "answering" | "result" | "done" | "error";

export function QuizSession({ classId, unit }: { classId: string; unit: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<QuizQuestionWithImage | null>(null);
  const [difficulty, setDifficulty] = useState(3);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solvedCount, setSolvedCount] = useState(0);
  // 이번 회차에 이미 푼 문항들 — 서버가 다음 문항 선정 시 제외한다 (틀린 문항도 이번 회차엔 재출제 안 함).
  const [attemptedIds, setAttemptedIds] = useState<string[]>([]);

  useEffect(() => {
    startQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startQuiz() {
    setPhase("loading");
    setError(null);
    setAttemptedIds([]);
    setSolvedCount(0);
    setResult(null);
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unit }),
      });
      const data = await parseJsonResponse<{ question?: QuizQuestionWithImage | null; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "문제를 불러오지 못했습니다.");

      if (!data.question) {
        setPhase("done");
        return;
      }
      setQuestion(data.question);
      setDifficulty(3);
      setAnswer("");
      setPhase("answering");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setPhase("error");
    }
  }

  async function submitAnswer() {
    if (!question || !answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const attempted = Array.from(new Set([...attemptedIds, question.id]));
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          submittedAnswer: answer,
          currentDifficulty: difficulty,
          attemptedIds: attempted,
        }),
      });
      const data = await parseJsonResponse<AnswerResult & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "채점에 실패했습니다.");

      setAttemptedIds(attempted);
      setResult(data);
      setDifficulty(data.nextDifficulty);
      setSolvedCount((c) => c + 1);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (!result) return;
    if (!result.nextQuestion) {
      setPhase("done");
      return;
    }
    setQuestion(result.nextQuestion);
    setAnswer("");
    setResult(null);
    setPhase("answering");
  }

  if (phase === "loading") {
    return <p className="text-sm text-gray-500">문제를 불러오는 중...</p>;
  }

  if (phase === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={startQuiz}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">이번 회차를 모두 풀었어요!</p>
        {solvedCount > 0 && <p className="text-sm text-green-700">이번 회차에 {solvedCount}문제를 풀었어요.</p>}
        <p className="text-sm text-green-700">
          틀린 문항은 이번 회차에는 다시 나오지 않았어요. 대시보드의 개념 설명으로 복습한 뒤 다시 도전하면
          아직 맞히지 못한 문항에 재도전할 수 있어요.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={startQuiz}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            다시 도전하기
          </button>
          <Link
            href={`/student/quiz/${classId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            다른 단원 풀기
          </Link>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>난이도 {question.difficulty} / 5</span>
        <span>{solvedCount}문제 풀이 완료</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <MathText text={question.content} className="block whitespace-pre-wrap text-sm text-gray-900" />
        {question.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.imageUrl}
            alt="문제 그림"
            className="mt-3 max-h-96 rounded border border-gray-200"
          />
        )}

        {phase === "answering" && (
          <div className="mt-4 space-y-3">
            {question.type === "multiple" ? (
              <div className="space-y-2">
                {(question.options ?? []).map((opt, i) => (
                  <label
                    key={i}
                    className={`block cursor-pointer rounded-md border px-3 py-2 text-sm ${
                      answer === opt ? "border-gray-900 bg-gray-50" : "border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={opt}
                      checked={answer === opt}
                      onChange={() => setAnswer(opt)}
                      className="mr-2"
                    />
                    <MathText text={opt} />
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="답안을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={submitAnswer}
              disabled={submitting || !answer.trim()}
              className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "채점 중..." : "제출하기"}
            </button>
          </div>
        )}

        {phase === "result" && result && (
          <div className="mt-4 space-y-3">
            <p
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                result.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {result.isCorrect ? "정답입니다!" : "오답입니다"}
            </p>
            <MathText text={result.feedback} className="block whitespace-pre-wrap text-sm text-gray-700" />
            {result.conceptExplanation && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">개념 다시 보기</p>
                <MathText
                  text={result.conceptExplanation}
                  className="mt-1 block whitespace-pre-wrap text-sm text-amber-900"
                />
              </div>
            )}
            <button
              onClick={goNext}
              className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              다음 문제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
