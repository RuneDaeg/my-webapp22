-- 0001_init.sql을 이미 실행한 프로젝트에 적용하는 수정 마이그레이션.
-- classes ↔ class_enrollments SELECT 정책이 서로를 직접 참조해
-- "infinite recursion detected in policy for relation classes" (42P17) 에러가 발생하던 것을 고친다.
-- security definer 함수로 상대 테이블 조회를 감싸 RLS 재귀 평가를 우회한다.

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

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select using (
    teacher_id = auth.uid() or public.is_enrolled_in_class(id)
  );

drop policy if exists class_enrollments_select on public.class_enrollments;
create policy class_enrollments_select on public.class_enrollments
  for select using (
    student_id = auth.uid() or public.is_teacher_of_class(class_id)
  );

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (
    teacher_id = auth.uid() or public.is_enrolled_in_class(class_id)
  );
