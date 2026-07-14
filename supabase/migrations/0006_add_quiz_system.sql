-- CAT 기반 적응형 문제 풀이 (문제은행) — 신규 스키마 + RLS
-- 적용: supabase db push

-- ============================================================
-- 1. quiz_questions (문제은행)
-- ============================================================
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  unit text not null,
  type text not null check (type in ('multiple', 'subjective')),
  content text not null,
  options text[],
  answer text not null,
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  concept_keyword text,
  status text not null default 'published' check (status in ('pending_review', 'published')),
  source_pdf_path text,
  source_page integer,
  created_at timestamptz not null default now()
);

create index quiz_questions_class_id_idx on public.quiz_questions (class_id);
create index quiz_questions_class_unit_idx on public.quiz_questions (class_id, unit);

-- ============================================================
-- 2. quiz_attempts (풀이 이력)
-- ============================================================
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  submitted_answer text,
  is_correct boolean not null,
  difficulty_at_attempt smallint not null,
  ai_feedback text,
  created_at timestamptz not null default now()
);

create index quiz_attempts_class_id_idx on public.quiz_attempts (class_id);
-- mastery 계산(DISTINCT ON (question_id) ... ORDER BY created_at DESC)에 쓰인다.
create index quiz_attempts_student_question_idx on public.quiz_attempts (student_id, question_id, created_at desc);

-- ============================================================
-- 3. quiz_concept_reviews (오답 개념 설명 캐시)
-- ============================================================
create table public.quiz_concept_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  unit text not null,
  keyword text not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (student_id, unit, keyword)
);

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_concept_reviews enable row level security;

-- ---- quiz_questions ----
-- 교사 본인 것 전부, 학생은 공개(published)된 본인 클래스 문항만
create policy quiz_questions_select on public.quiz_questions
  for select using (
    teacher_id = auth.uid()
    or (status = 'published' and public.is_enrolled_in_class(class_id))
  );

create policy quiz_questions_insert on public.quiz_questions
  for insert with check (
    public.current_role() = 'teacher'
    and teacher_id = auth.uid()
    and public.is_teacher_of_class(class_id)
  );

create policy quiz_questions_update on public.quiz_questions
  for update using (teacher_id = auth.uid());

create policy quiz_questions_delete on public.quiz_questions
  for delete using (teacher_id = auth.uid());

-- ---- quiz_attempts ----
create policy quiz_attempts_select on public.quiz_attempts
  for select using (
    student_id = auth.uid() or public.is_teacher_of_class(class_id)
  );

create policy quiz_attempts_insert on public.quiz_attempts
  for insert with check (
    public.current_role() = 'student'
    and student_id = auth.uid()
    and public.is_enrolled_in_class(class_id)
  );

-- ---- quiz_concept_reviews ----
-- 학생 본인의 학습 데이터이므로 세션 클라이언트로 직접 읽고 쓴다 (service-role 불필요).
create policy quiz_concept_reviews_own on public.quiz_concept_reviews
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
