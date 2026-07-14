-- AI 채점 근거(교사 전용, 학생에게는 절대 노출되지 않음) 저장 컬럼 추가.
-- student_grading_results 뷰는 이 컬럼을 select하지 않으므로 학생에게는 자동으로 노출되지 않는다.
alter table public.grading_results
  add column if not exists ai_rationale text;
