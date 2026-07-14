-- 클래스 단위 통과율 기반 AI 분석 캐시. 집계 통계(signature)가 그대로면 재생성하지 않고 저장본을 재사용.
create table public.quiz_class_analysis (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes (id) on delete cascade,
  signature text not null,
  analysis text not null,
  updated_at timestamptz not null default now()
);

alter table public.quiz_class_analysis enable row level security;

-- 교사는 본인 클래스 분석만 조회/생성한다.
create policy quiz_class_analysis_teacher on public.quiz_class_analysis
  for all using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
