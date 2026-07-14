-- 페이지 관리자(admin) 역할 추가 + 권한 상승 차단.

-- 1. role에 'admin' 허용
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('teacher', 'student', 'admin'));

-- 2. 신규 가입은 항상 student로 고정한다.
--    (지금까지는 클라이언트가 metadata의 role을 그대로 신뢰해 아무나 교사로 가입할 수 있었음 —
--     교사/관리자 계정은 관리자만 발급하도록 잠근다.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

-- 3. 역할 변경은 service_role(관리자 서버 액션)로만 허용한다.
--    PostgREST가 service_role 키로 접속하면 current_user = 'service_role'이 된다.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and current_user <> 'service_role' then
    raise exception 'role은 변경할 수 없습니다';
  end if;
  return new;
end;
$$;
