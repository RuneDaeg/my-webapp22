-- 교사가 담당 클래스 학생 전체에게 보내는 공지.
create table public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index class_announcements_class_id_idx on public.class_announcements (class_id, created_at desc);

alter table public.class_announcements enable row level security;

-- 교사는 본인 클래스 공지를 작성/삭제한다.
create policy class_announcements_teacher on public.class_announcements
  for all using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));

-- 등록된 학생은 공지를 읽을 수 있다.
create policy class_announcements_student_select on public.class_announcements
  for select using (public.is_enrolled_in_class(class_id));
