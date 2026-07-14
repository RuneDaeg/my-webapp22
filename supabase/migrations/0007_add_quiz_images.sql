-- 문제은행 문항 그림 첨부 (PDF에서 크롭하거나 직접 업로드)

alter table public.quiz_questions add column if not exists image_path text;

-- 비공개 버킷. 경로 규칙: {teacher_id}/{class_id}/{uuid}.png — 최상위 폴더가 소유 교사 uid.
-- 학생에게는 quiz API가 접근 권한(RLS로 문항 조회 가능 여부) 확인 후 signed URL로만 노출한다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('quiz-images', 'quiz-images', false, 5242880)
on conflict (id) do nothing;

create policy quiz_images_owner_all on storage.objects
  for all using (
    bucket_id = 'quiz-images' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'quiz-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
