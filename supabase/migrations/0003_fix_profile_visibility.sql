-- 교사가 자기 클래스 학생 이름을 못 보고(제출물 목록에 "이름 없음"), 학생도 교사 이름을
-- 못 보던 문제를 고친다. profiles 테이블 RLS가 본인 행만 허용했던 것이 원인.
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
