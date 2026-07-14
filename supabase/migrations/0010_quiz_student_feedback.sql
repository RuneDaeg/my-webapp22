-- 교사가 학생별로 남기는 종합 피드백 (개별 풀이가 아니라 학생 전체에 대한 총평).
create table public.quiz_student_feedback (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  feedback text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

alter table public.quiz_student_feedback enable row level security;

-- 교사는 본인 클래스 학생의 종합 피드백을 자유롭게 작성/수정한다.
create policy quiz_student_feedback_teacher on public.quiz_student_feedback
  for all using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));

-- 학생은 본인에게 남겨진 피드백을 읽을 수 있다.
create policy quiz_student_feedback_student_select on public.quiz_student_feedback
  for select using (student_id = auth.uid());
