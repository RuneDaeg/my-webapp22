-- 교사별 생성형 AI API 키. 교사마다 본인 키(Gemini/OpenAI/Anthropic)를 넣어 쓴다.
-- [보안] 이 테이블은 RLS를 켜되 정책을 하나도 두지 않는다 → service-role(서버)만 접근 가능.
--        api_key는 절대 클라이언트로 나가지 않으며, 모든 읽기/쓰기는 세션을 검증한 서버 코드가
--        admin 클라이언트로만 수행한다.
create table public.teacher_ai_credentials (
  teacher_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'anthropic')),
  api_key text not null,
  model text,
  updated_at timestamptz not null default now()
);

alter table public.teacher_ai_credentials enable row level security;
-- 정책 없음: anon/authenticated는 접근 불가. service-role만 RLS를 우회해 접근한다.
