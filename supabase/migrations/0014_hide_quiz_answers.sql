-- [보안] 학생이 문항의 정답(answer)을 직접 읽을 수 있던 문제를 막는다.
-- RLS는 행 단위라, "학생이 자기 클래스의 공개 문항을 읽을 수 있다"는 정책은 answer 칼럼까지 함께
-- 노출한다. 실제로 학생 계정 + 공개 anon 키로 `select answer from quiz_questions`가 통했다.
-- => 학생은 테이블을 직접 못 읽게 하고, 정답을 뺀 전용 뷰로만 읽게 한다.
--    (세특을 가리는 student_grading_results 뷰와 동일한 패턴)

drop policy if exists quiz_questions_select on public.quiz_questions;

-- 교사는 본인 문항 전체(정답 포함)를 계속 직접 조회한다.
create policy quiz_questions_select_teacher on public.quiz_questions
  for select using (teacher_id = auth.uid());

-- 학생용 뷰: answer 칼럼이 아예 없다.
-- security_invoker를 켜면 기저 테이블 RLS(이제 교사 전용)가 적용돼 학생에게 아무것도 안 보이므로
-- 기본값(정의자 권한)으로 두고, 아래 WHERE로만 접근을 제한한다.
create view public.student_quiz_questions as
select
  q.id,
  q.class_id,
  q.unit,
  q.type,
  q.content,
  q.options,
  q.difficulty,
  q.concept_keyword,
  q.status,
  q.image_path,
  q.created_at
from public.quiz_questions q
where q.status = 'published' and public.is_enrolled_in_class(q.class_id);

grant select on public.student_quiz_questions to authenticated;
