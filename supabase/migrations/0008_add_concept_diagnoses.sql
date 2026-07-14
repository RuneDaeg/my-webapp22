-- 학생 대시보드의 "틀린 개념 AI 분석" 캐시.
-- signature(현재 틀린 개념 키워드 집합)가 그대로면 새로 생성하지 않고 저장된 분석을 재사용한다 —
-- 새로고침/탭 이동만으로 AI 텍스트가 바뀌지 않게 하기 위함. 틀린 개념 집합이 실제로 달라질 때만 갱신.
create table public.quiz_concept_diagnoses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  signature text not null,
  keywords text[] not null default '{}',
  diagnosis text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_id)
);

alter table public.quiz_concept_diagnoses enable row level security;

-- 학생 본인의 학습 데이터 — 세션 클라이언트로 직접 읽고 쓴다.
create policy quiz_concept_diagnoses_own on public.quiz_concept_diagnoses
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
