-- student_grading_results 뷰가 security_invoker=true라 학생이 조회할 때 grading_results의
-- 기저 RLS(교사만 select 허용)가 그대로 적용되어 공개된 결과도 안 보이던 버그를 고친다.
-- 정의자 권한(기본값)으로 되돌리고, 뷰 자체의 WHERE 절(visible_to_student=true AND
-- 본인 제출물)만으로 접근을 제한한다.
alter view public.student_grading_results set (security_invoker = false);
