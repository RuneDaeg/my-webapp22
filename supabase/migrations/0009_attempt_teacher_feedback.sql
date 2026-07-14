-- 교사가 학생의 개별 풀이에 남기는 코멘트.
alter table public.quiz_attempts add column if not exists teacher_feedback text;

-- 대시보드 개념 분석을 "개념별 카드"(quiz_concept_reviews 기반)로 바꾸면서 종합 진단 캐시는 더 이상 쓰지 않는다.
drop table if exists public.quiz_concept_diagnoses;
