import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

type Client = SupabaseClient<Database>;

export interface Bucket {
  label: string;
  total: number;
  correct: number;
  rate: number; // 0~100 정수
}

export interface ClassStats {
  totalAttempts: number;
  studentCount: number;
  concepts: Bucket[]; // 통과율 낮은 순
  types: Bucket[];
  difficulties: Bucket[];
}

const TYPE_LABEL: Record<string, string> = { multiple: "객관식", subjective: "서술형" };

interface AttemptJoin {
  is_correct: boolean;
  student_id: string;
  quiz_questions: { concept_keyword: string | null; type: string; difficulty: number } | null;
}

function toBucket(label: string, total: number, correct: number): Bucket {
  return { label, total, correct, rate: total > 0 ? Math.round((correct / total) * 100) : 0 };
}

// 클래스의 모든 풀이를 개념별·유형별·난이도별 통과율로 집계한다. RLS로 교사 본인 클래스만 조회됨.
export async function computeClassStats(supabase: Client, classId: string): Promise<ClassStats> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("is_correct, student_id, quiz_questions(concept_keyword, type, difficulty)")
    .eq("class_id", classId)
    .limit(5000)
    .overrideTypes<AttemptJoin[], { merge: false }>();

  const rows = data ?? [];
  const students = new Set<string>();
  const agg = <K extends string | number>() => new Map<K, { total: number; correct: number }>();
  const byConcept = agg<string>();
  const byType = agg<string>();
  const byDiff = agg<number>();

  const bump = <K extends string | number>(m: Map<K, { total: number; correct: number }>, key: K, ok: boolean) => {
    const e = m.get(key) ?? { total: 0, correct: 0 };
    e.total += 1;
    if (ok) e.correct += 1;
    m.set(key, e);
  };

  for (const r of rows) {
    students.add(r.student_id);
    const q = r.quiz_questions;
    if (!q) continue;
    if (q.concept_keyword) bump(byConcept, q.concept_keyword, r.is_correct);
    bump(byType, q.type, r.is_correct);
    bump(byDiff, q.difficulty, r.is_correct);
  }

  const concepts = Array.from(byConcept.entries())
    .map(([k, v]) => toBucket(k, v.total, v.correct))
    .sort((a, b) => a.rate - b.rate);
  const types = Array.from(byType.entries())
    .map(([k, v]) => toBucket(TYPE_LABEL[k] ?? k, v.total, v.correct))
    .sort((a, b) => a.rate - b.rate);
  const difficulties = Array.from(byDiff.entries())
    .map(([k, v]) => toBucket(`난이도 ${k}`, v.total, v.correct))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { totalAttempts: rows.length, studentCount: students.size, concepts, types, difficulties };
}

// 집계 결과가 실제로 바뀌었을 때만 AI 분석을 재생성하도록 하는 서명(개념·유형별 통과율 스냅샷).
export function statsSignature(s: ClassStats): string {
  const c = s.concepts.map((b) => `${b.label}:${b.rate}:${b.total}`).join(",");
  const t = s.types.map((b) => `${b.label}:${b.rate}:${b.total}`).join(",");
  return `${s.totalAttempts}|${c}|${t}`;
}
