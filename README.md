# 과제 채점 도우미

학생이 과제 파일(pdf/docx/hwpx/txt)을 제출하면, 교사가 채점 기준을 바탕으로 Gemini API를 이용해 AI 채점·피드백·"과목별 세부능력 및 특기사항" 초안을 생성하고 검토/공개할 수 있는 웹앱입니다.

Next.js(App Router) + Supabase(Postgres/Auth/Storage) + Google Gemini API로 만들어졌습니다.

## 시작하기 전 준비물

1. **Supabase 프로젝트** — https://supabase.com/dashboard 에서 새 프로젝트 생성
2. **Gemini API 키** — https://aistudio.google.com/apikey 에서 발급

## 1. 환경변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채워주세요.

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase 프로젝트의 **Project Settings → API**에서 확인
- `GEMINI_API_KEY` — Google AI Studio에서 발급한 키

## 2. Supabase 스키마 적용

`supabase/migrations/0001_init.sql` 파일을 Supabase Dashboard의 **SQL Editor**에 붙여넣고 실행하세요.

이 마이그레이션은 다음을 생성합니다:
- 테이블: `profiles`, `classes`, `class_enrollments`, `assignments`, `grading_criteria`, `submissions`, `grading_results`
- 모든 테이블의 Row Level Security(RLS) 정책 — 학생은 본인 데이터/본인이 속한 클래스만, 교사는 본인 소유 클래스·과제만 접근 가능
- 학생용 조회 뷰 `student_grading_results` (세특 초안은 절대 포함하지 않음, 공개된 점수/피드백만 노출)
- 비공개 Storage 버킷 `criteria-files`, `submission-files`

### Supabase CLI로 마이그레이션 적용 (선택)

SQL Editor에 매번 복붙하는 대신 CLI로 바로 반영하고 싶다면:

1. `.env.local`에 `SUPABASE_ACCESS_TOKEN`([발급](https://supabase.com/dashboard/account/tokens))과 `SUPABASE_DB_PASSWORD`(Project Settings → Database)를 채운다.
2. 아래 명령으로 프로젝트를 연동한다 (최초 1회):
   ```bash
   set -a && source .env.local && set +a
   npx supabase link --project-ref <project-ref> --password "$SUPABASE_DB_PASSWORD"
   ```
3. 이후 마이그레이션 파일을 추가/수정했다면:
   ```bash
   set -a && source .env.local && set +a
   npx supabase db push
   ```
   `--dry-run`을 붙이면 실제 적용 없이 무엇이 반영될지만 미리 볼 수 있습니다.

이미 SQL Editor로 수동 실행한 마이그레이션이 있다면 `supabase migration list`로 로컬/원격 상태를 비교하고, 실제로는 적용됐지만 CLI가 모르는 버전은 `supabase migration repair --status applied <버전>`으로 기록만 맞춰주면 된다 (재실행하지 않음).

### 이메일 인증(email confirmation) 설정 확인

Supabase 프로젝트의 **Authentication → Providers → Email**에서 "Confirm email"이 켜져 있으면 회원가입 후 이메일 인증 링크를 클릭해야 로그인할 수 있습니다. 로컬 테스트를 빠르게 하고 싶다면 이 옵션을 꺼두어도 됩니다 (프로덕션에서는 켜두는 것을 권장).

## 3. 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 4. 테스트 흐름

1. `/signup`에서 교사 계정과 학생 계정을 각각 만듭니다.
2. 교사: 클래스 생성 → 참여 코드 확인
3. 학생: `/student/join`에서 참여 코드 입력
4. 교사: 과제 생성 (채점 기준을 텍스트로 입력하거나 pdf/docx/hwpx/txt 파일 업로드)
5. 학생: 과제 페이지에서 제출 파일 업로드
6. 교사: 과제 상세 → 제출물 클릭 → "AI 채점 실행" → 결과 검토/수정 → "저장 및 학생에게 공개"
7. 학생: 과제 페이지에서 공개된 점수/피드백 확인 (세특 초안은 교사만 볼 수 있음)

## 알려진 한계 (MVP)

- **HWPX 텍스트 추출**은 자체 구현한 파서로 문단/표 텍스트를 추출하지만 표의 행/열 구조와 이미지 내용은 반영하지 못합니다.
- 구버전 바이너리 `.hwp` 파일은 지원하지 않습니다 (`.hwpx`만 지원, 한글에서 "다른 이름으로 저장" → HWPX 선택).
- 스캔 이미지로만 이루어진 PDF는 텍스트 추출이 되지 않아 업로드가 거부됩니다.
- 재제출 시 이전 제출 파일과 AI 채점 결과는 덮어써집니다(이력 관리 없음).
- 일괄 채점(여러 학생을 한 번에 채점) 기능은 없습니다 — 제출물별로 개별 실행합니다.
