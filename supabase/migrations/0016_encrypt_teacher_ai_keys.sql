-- 교사 AI API 키를 평문이 아니라 AES-256-GCM 암호문으로 저장한다.
-- [보안] 0015에서는 api_key가 평문이라 Supabase 대시보드/DB 덤프/service_role 키만 있으면
--        전 교사의 API 키를 읽을 수 있었다. 이제 복호화 키(AI_KEY_ENCRYPTION_SECRET)는 DB가 아니라
--        서버 환경변수에 있어, Supabase 접근 권한만으로는 키를 복원할 수 없다.
--
-- 저장 포맷은 "v1:<iv>:<authTag>:<ciphertext>" (각 구간 base64) — 암·복호화는 lib/ai/crypto.ts.
-- 컬럼 타입은 그대로 text이고, 평문으로 남아 있는 기존 행은 lib/ai/credential.ts의
-- getTeacherCredential이 처음 사용할 때 암호문으로 교체한다(교사 재등록 불필요).
comment on column public.teacher_ai_credentials.api_key is
  'AES-256-GCM 암호문 "v1:<iv>:<tag>:<ciphertext>" (base64). 평문 금지 — lib/ai/crypto.ts 참조.';
