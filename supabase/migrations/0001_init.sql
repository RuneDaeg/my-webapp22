-- 학생 과제 AI 채점 웹앱 — 초기 스키마 + RLS
-- 적용: supabase db push  (또는 Supabase Dashboard SQL Editor에 붙여넣기)

-- ============================================================
-- 0. 확장 기능
-- ============================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
-- 1. profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  display_name text not null default '',
  school_name text,
  created_at timestamptz not null default now()
);

-- 신규 auth.users 가입 시 profiles 행을 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role 변경(가입 후 역할 전환)을 막는다
create function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role then
    raise exception 'role은 변경할 수 없습니다';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- 재귀적 RLS 조회를 피하기 위한 헬퍼 함수
create function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- 2. classes
-- ============================================================
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create index classes_teacher_id_idx on public.classes (teacher_id);

-- ============================================================
-- 3. class_enrollments
-- ============================================================
create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index class_enrollments_class_id_idx on public.class_enrollments (class_id);
create index class_enrollments_student_id_idx on public.class_enrollments (student_id);

-- ============================================================
-- 4. assignments
-- ============================================================
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  subject text,
  description text,
  due_at timestamptz,
  scoring_type text not null default 'label' check (scoring_type in ('numeric', 'label')),
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);

create index assignments_class_id_idx on public.assignments (class_id);
create index assignments_teacher_id_idx on public.assignments (teacher_id);

-- ============================================================
-- 5. grading_criteria
-- ============================================================
create table public.grading_criteria (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  criteria_text text,
  source_type text not null check (source_type in ('text', 'file')),
  file_path text,
  file_mime text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. submissions
-- ============================================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  file_path text not null,
  file_mime text not null,
  original_filename text not null,
  extracted_text text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'ok', 'failed')),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index submissions_assignment_id_idx on public.submissions (assignment_id);
create index submissions_student_id_idx on public.submissions (student_id);

-- ============================================================
-- 7. grading_results
-- ============================================================
create table public.grading_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  score numeric,
  score_label text,
  ai_feedback text,
  ai_septeuk text,
  ai_rationale text, -- 채점 근거, 교사 전용 (student_grading_results 뷰에서 select 안 함)
  final_score numeric,
  final_feedback text,
  final_septeuk text,
  status text not null default 'pending' check (status in ('pending', 'graded', 'reviewed')),
  visible_to_student boolean not null default false,
  raw_model_response jsonb,
  model_name text,
  graded_at timestamptz,
  reviewed_at timestamptz
);

create index grading_results_submission_id_idx on public.grading_results (submission_id);

-- ============================================================
-- 8. RLS 활성화
-- ============================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.grading_criteria enable row level security;
alter table public.submissions enable row level security;
alter table public.grading_results enable row level security;

-- ---- profiles ----
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

-- 교사는 자기 클래스에 등록된 학생 프로필을, 학생은 자기 담당 교사 프로필을 볼 수 있어야
-- 제출물 목록/로스터에 이름이 뜬다 (같은 command에 대한 정책은 OR로 합쳐진다).
create policy profiles_select_classmates on public.profiles
  for select using (
    exists (
      select 1 from public.class_enrollments ce
      join public.classes c on c.id = ce.class_id
      where ce.student_id = profiles.id and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.class_enrollments ce
      join public.classes c on c.id = ce.class_id
      where c.teacher_id = profiles.id and ce.student_id = auth.uid()
    )
  );

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- insert는 handle_new_user 트리거(security definer)로만 수행되므로 클라이언트 insert 정책 없음

-- classes와 class_enrollments의 SELECT 정책은 서로를 참조한다. EXISTS 서브쿼리를
-- 정책 안에 직접 쓰면 상대 테이블의 RLS 정책을 다시 평가하다가 무한 재귀
-- (42P17 infinite recursion detected in policy)에 빠지므로, security definer
-- 함수로 감싸 RLS를 우회한 채 조회하도록 한다 (current_role()과 동일한 패턴).
create function public.is_teacher_of_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.teacher_id = auth.uid()
  );
$$;

create function public.is_enrolled_in_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_enrollments ce
    where ce.class_id = target_class_id and ce.student_id = auth.uid()
  );
$$;

-- ---- classes ----
create policy classes_select on public.classes
  for select using (
    teacher_id = auth.uid() or public.is_enrolled_in_class(id)
  );

create policy classes_insert on public.classes
  for insert with check (public.current_role() = 'teacher' and teacher_id = auth.uid());

create policy classes_update on public.classes
  for update using (teacher_id = auth.uid());

create policy classes_delete on public.classes
  for delete using (teacher_id = auth.uid());

-- ---- class_enrollments ----
-- insert는 /api/classes/join 라우트(service-role)에서만 수행 — 클라이언트 insert 정책 없음
create policy class_enrollments_select on public.class_enrollments
  for select using (
    student_id = auth.uid() or public.is_teacher_of_class(class_id)
  );

-- ---- assignments ----
create policy assignments_select on public.assignments
  for select using (
    teacher_id = auth.uid() or public.is_enrolled_in_class(class_id)
  );

create policy assignments_insert on public.assignments
  for insert with check (
    public.current_role() = 'teacher'
    and teacher_id = auth.uid()
    and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy assignments_update on public.assignments
  for update using (teacher_id = auth.uid());

create policy assignments_delete on public.assignments
  for delete using (teacher_id = auth.uid());

-- ---- grading_criteria ----
create policy grading_criteria_select on public.grading_criteria
  for select using (
    exists (
      select 1 from public.assignments a
      where a.id = grading_criteria.assignment_id
        and (
          a.teacher_id = auth.uid()
          or exists (
            select 1 from public.class_enrollments ce
            where ce.class_id = a.class_id and ce.student_id = auth.uid()
          )
        )
    )
  );

create policy grading_criteria_insert on public.grading_criteria
  for insert with check (
    exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
  );

create policy grading_criteria_update on public.grading_criteria
  for update using (
    exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
  );

create policy grading_criteria_delete on public.grading_criteria
  for delete using (
    exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
  );

-- ---- submissions ----
create policy submissions_select on public.submissions
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  );

create policy submissions_insert on public.submissions
  for insert with check (
    public.current_role() = 'student'
    and student_id = auth.uid()
    and exists (
      select 1 from public.assignments a
      join public.class_enrollments ce on ce.class_id = a.class_id
      where a.id = assignment_id and a.status = 'open' and ce.student_id = auth.uid()
    )
  );

create policy submissions_update on public.submissions
  for update using (
    student_id = auth.uid()
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.status = 'open')
  );

create policy submissions_delete on public.submissions
  for delete using (student_id = auth.uid());

-- ---- grading_results ----
-- 모든 쓰기는 서버(API 라우트, service-role)에서만 수행 — 클라이언트 insert/update 정책 없음
create policy grading_results_select_teacher on public.grading_results
  for select using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grading_results.submission_id and a.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- 9. 학생용 결과 뷰 (세특 제외, 공개된 항목만)
-- ============================================================
-- security_invoker를 켜면 학생이 조회할 때 grading_results의 기저 RLS(교사만 허용)까지
-- 적용되어 아무 것도 안 보이게 된다. 기본값(정의자 권한)으로 두고 아래 WHERE 절
-- (visible_to_student=true AND 본인 제출물)만으로 접근을 제한한다.
create view public.student_grading_results as
select
  gr.id,
  gr.submission_id,
  s.assignment_id,
  s.student_id,
  gr.final_score as score,
  gr.score_label,
  gr.final_feedback as feedback,
  gr.status,
  gr.reviewed_at
from public.grading_results gr
join public.submissions s on s.id = gr.submission_id
where gr.visible_to_student = true and s.student_id = auth.uid();

grant select on public.student_grading_results to authenticated;

-- ============================================================
-- 10. Storage 버킷 + 정책
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('criteria-files', 'criteria-files', false, 20971520),
  ('submission-files', 'submission-files', false, 20971520)
on conflict (id) do nothing;

-- 경로 규칙: {bucket}/{owner_id}/{assignment_id}/{filename} — 최상위 폴더가 소유자 uid와 일치해야 함
create policy criteria_files_owner_all on storage.objects
  for all using (
    bucket_id = 'criteria-files' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'criteria-files' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy submission_files_owner_all on storage.objects
  for all using (
    bucket_id = 'submission-files' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'submission-files' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 교사의 학생 제출 파일 접근, 학생의 채점기준 파일 열람은 storage RLS로 처리하지 않고
-- 서버 API(service-role, DB 소유권 검증 후 signed URL 발급)로만 처리한다.
