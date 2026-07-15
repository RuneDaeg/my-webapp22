<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 프로젝트: 과제 채점 도우미

학생이 과제 파일(pdf/docx/hwpx/txt)을 제출하면 교사가 채점 기준을 바탕으로 Gemini API로 AI 채점·피드백·
"과목별 세부능력 및 특기사항" 초안을 생성하는 앱. Next.js(App Router) + Supabase(Postgres/Auth/Storage) +
Google Gemini. 자세한 설정/실행 방법은 [README.md](README.md) 참고.

## 주요 기능 (현재까지 구현된 것)

- **과제 제출·AI 채점**: 학생이 파일 제출 → 교사가 채점 기준 등록 → Gemini가 점수·학생 피드백·세특 초안·
  채점 근거(교사 전용) 생성. 교사가 검토·수정 후 학생에게 공개. 세특은 수식/영어 금지 등 NEIS 규정 반영.
- **평가계획 가져오기**(`/teacher/assignments/import`): 학기 평가계획 PDF → Gemini가 수행평가 항목별로
  분리하고 성취기준/평가요소·배점/채점기준/평가방법/유의점을 구조화 추출 → 위저드에서 검토·수정·병합·
  전체선택 → 여러 클래스에 초안 과제 일괄 생성. 채점기준은 영역·배점단계별로 줄바꿈 정리된다.
- **적응형 문제풀이(CAT)**: 클래스별 문제은행(수동 입력 + 문제지 PDF 일괄추출, 문항 그림은 PDF에서 드래그
  크롭). 학생이 풀면 오답 시 같은 개념→난이도→미해결 순으로 다음 문항 자동 선정. 객관식은 문자열 일치,
  서술형은 Gemini가 정오답 판단. 오답 개념 설명 캐싱. **한 회차 동안 푼 문항은 다시 안 나오고**(복습 후
  재도전), 피드백은 정답을 직접 알려주지 않는다. 수식은 $...$ LaTeX(KaTeX 렌더).
- **학생 대시보드**: 공지 / 문제 풀기 / 복습 필요 개념(개념별 카드) / 선생님 종합·문항별 피드백.
- **교사 대시보드**(`app/teacher/dashboard`): 요약 타일(클래스·학생·진행중 과제·검토 대기) + 검토·채점 대기
  + 마감 임박 과제(제출 현황) + 클래스별 정답률 + 학습 지원 필요 학생. 집계는 `lib/teacher/dashboard.ts`.
- **클래스 학습 분석**(`/teacher/classes/[id]/quiz-analysis`): 개념·유형·난이도별 통과율 표 + AI 약점 분석
  (signature 캐시). "학생 피드백 모아보기"에서 학생별 AI 피드백 열람 + 문항별/종합 교사 피드백 작성.
- **공지**: 교사가 클래스 학생 전체에게 공지 게시(`class_announcements`), 학생 대시보드에 표시.
- **관리자**: 페이지 관리자가 교사 계정 발급(임시 비밀번호 1회 표시). 교사 자율가입 차단. 모든 역할이
  `/account`에서 비밀번호 변경.

## 배포 워크플로 (확정된 방침)

- **코드를 수정하면 바로 프로덕션에 배포한다.** 사용자가 매번 로컬로 확인하는 게 느리다며 요청한
  방식 — 별도 확인 없이 변경 후 `npx vercel --prod` 실행.
- **배포할 때 GitHub에도 함께 push한다** (사용자 요청). 즉 변경 후:
  `npx vercel --prod` → `git add -A && git commit -m "..." && git push`.
  원격: https://github.com/RuneDaeg/my-webapp22 (Private, 기본 브랜치 `main`).
  git 사용자 정보는 이 저장소에 local로 설정돼 있고(`user.name=rune5`, `user.email=kmo4102@gmail.com`),
  push 인증은 Git Credential Manager + `gh auth login`(RuneDaeg 계정)으로 이미 저장돼 있어 추가 입력 불필요.
  `.env.local`은 `.gitignore`로 제외되니 절대 커밋되지 않게 유지한다.
- 프로덕션 주소: https://my-webapp22.vercel.app (Vercel 프로젝트: `rune5/my-webapp22`)
- 로컬/프로덕션이 **같은 Supabase 프로젝트**(DB 1개)를 공유한다 — 로컬에서 만든 테스트 계정/데이터가
  프로덕션에도 그대로 보인다.
- Supabase 마이그레이션 적용:
  ```bash
  set -a && source .env.local && set +a
  npx supabase db push          # 스키마 변경
  npx supabase config push      # auth/storage 설정 변경 (supabase/config.toml)
  ```
  `.env.local`에 `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`가 있어야 함. 마이그레이션 파일은
  새 번호로 계속 추가만 하고(`0001_...`, `0002_...`) 이미 적용된 파일은 수정하지 않는다.

## 테스트 계정 (로컬/프로덕션 공용)

- 관리자(admin): `admin-test01@mailinator.com` / `testpass1234`
- 교사: `teacher-test01@mailinator.com` / `testpass1234`
- 학생: `student-test01@mailinator.com` / `testpass1234`
- 테스트 클래스 "3학년 2반 국어" (참여 코드 `6V4RMD`)

## 역할(role) 구조와 보안

- role은 `admin`/`teacher`/`student` 3종(`profiles.role`).
- **신규 가입은 트리거(`handle_new_user`)가 항상 `student`로 강제**한다 — 예전엔 클라이언트가
  metadata의 role을 그대로 신뢰해 아무나 교사로 가입할 수 있었음. 교사 계정은 관리자만 발급한다.
- **role 변경은 service_role만 허용**(`prevent_role_change`가 `current_user <> 'service_role'`이면 차단).
  그래서 관리자 서버 액션은 admin(service-role) 클라이언트로 `profiles.role`을 승격한다.
- 관리자 교사 발급(`app/admin/actions.ts`): `auth.admin.createUser`로 계정 생성(트리거가 student로
  만듦) → service-role로 role='teacher' 승격 → 임시 비밀번호를 관리자에게 1회 표시(SMTP 불필요).
  실패 시 방금 만든 계정을 삭제해 롤백.
- 첫 관리자는 부트스트랩이 필요하다(관리자가 없으면 못 만듦) — service-role 스크립트로 계정 생성 후
  `profiles.role='admin'` 승격. (`admin-test01`이 그렇게 만들어짐.)
- 관리자는 전체 교사 목록을 볼 RLS 경로가 없으므로 `/admin` 페이지는 service-role로 조회한다(서버 전용).

## 알아두면 좋은 아키텍처 함정 (디버깅으로 찾아낸 것들)

- **Storage 키는 ASCII만 허용.** 한글 파일명을 그대로 저장 경로에 쓰면 `StorageApiError: Invalid key`
  로 실패한다. `lib/validation/fileValidation.ts`의 `sanitizeFilename()`이 이를 처리 — 원본 한글
  파일명은 DB `original_filename` 컬럼에 별도 저장해서 화면에는 정상 표시한다.
- **서로 참조하는 테이블의 RLS 정책은 `security definer` 함수로 감싸야 한다.** 안 그러면
  `infinite recursion detected in policy` (42P17) 에러. 예: `is_teacher_of_class`/`is_enrolled_in_class`
  (classes ↔ class_enrollments 상호 참조 때문에 필요했음).
- **다른 역할에게 제한된 데이터를 보여주는 뷰는 `security_invoker`를 켜면 안 된다.** 켜면 학생이 조회할
  때 기저 테이블의 RLS(교사만 허용 등)가 그대로 적용되어 아무 것도 안 보인다. 예: `student_grading_results`.
- **`getSession()`은 `React.cache()`로 감싸져 있다** — 레이아웃과 페이지가 각각 호출해도 요청당 Supabase
  호출은 한 번만 나간다. 이 패턴을 깨지 않도록 주의.
- **Vercel 서버리스 함수 리전은 `bom1`(뭄바이)로 고정**(`vercel.json`) — Supabase 프로젝트도 같은 리전
  (`ap-south-1`)이라 지연시간이 크게 줄어든다. Supabase 프로젝트 리전이 바뀌면 같이 바꿔야 한다.
- **Vercel Node 서버리스 함수는 기본 요청 본문 제한이 4.5MB** — `fileValidation`의 20MB 한도보다 낮아서,
  큰 파일 업로드가 플랫폼 단에서 막힐 수 있는 잠재적 리스크로 아직 미해결 상태.
- **PDF는 텍스트 추출이 아니라 원본을 통째로(inlineData, base64) Gemini에 보낸다** — 학생 제출물 채점
  (`lib/gemini/grade.ts`)과 평가계획 가져오기(`lib/gemini/planExtraction.ts`) 둘 다. 표/그림/사진까지
  채점에 반영하기 위함. docx/hwpx/txt는 여전히 `lib/extraction/`의 텍스트 추출 방식 사용 (Gemini가 이
  포맷들의 네이티브 비전 인식을 지원하지 않음).
- **적응형 문제풀이(`lib/quiz/adaptive.ts`)의 mastery 계산은 `quiz_attempts` 테이블을 실시간 조회해서
  구한다** (별도 mastery 컬럼 없음 — "가장 최근 시도가 정답이면 마스터"). 그래서 `app/api/quiz/answer`
  라우트는 반드시 **방금 푼 시도를 `quiz_attempts`에 먼저 insert한 뒤에** `selectNextQuestion()`을
  호출해야 한다 — 순서를 바꾸면 방금 정답을 맞힌 문제가 아직 "미해결"로 계산되어 똑같은 문제가 다시
  나오거나, 반대로 오답인데 그 문제만 유일하게 안 풀린 상태에서 "단원 완료"로 잘못 끝나버린다(테스트
  중 실제로 발견한 버그).
- **회차 내 재출제 방지는 클라이언트가 관리한다.** `QuizSession`이 이번 회차에 푼 문항 id를 누적해
  `/api/quiz/answer` 요청 본문(`attemptedIds`)으로 보내고, `selectNextQuestion`이 이를 제외한다. 서버는
  상태를 안 들고 있으므로 "회차" = 그 컴포넌트 수명(새로고침/다시 도전 시 초기화).
- **날짜/시간은 항상 `lib/datetime.ts`의 `formatKstDate/formatKstDateTime`로 표시한다.** 서버 컴포넌트는
  Vercel(UTC)에서 렌더링되므로 `timeZone: "Asia/Seoul"`을 명시하지 않으면 9시간 어긋나 UTC로 표시된다.
  `new Date(...).toLocaleString("ko-KR")`을 직접 쓰지 말 것.
- **Gemini 텍스트/서술형 채점 호출은 반드시 `thinkingConfig: { thinkingBudget: ... }`로 thinking을 줄이거나
  꺼야 한다.** gemini-2.5-flash의 기본 thinking 모드는 호출당 수십 초~수 분까지 걸려, `/api/quiz/answer`가
  오답 시 두 번(피드백+개념설명) 호출하면 함수 제한을 넘겨 504가 났었다. 문항 추출도 358초→38초로 단축.
  PDF 추출 라우트들은 `maxDuration = 120`도 함께 설정돼 있다.
- **AI 텍스트를 "새로고침해도 안 바뀌게" 하려면 signature 캐시 패턴을 쓴다.** 입력(집계/오답 개념 집합)을
  정렬해 서명으로 만들고 결과와 함께 저장 → 서명이 같으면 재생성 없이 저장본 반환. 예: 클래스 분석
  (`quiz_class_analysis`), 개념 설명(`quiz_concept_reviews`).
- **`quiz_concept_reviews`는 학생 본인만 읽는 RLS다** — 교사는 못 읽는다. 그래서 교사 대시보드의 "지원
  필요 학생"은 교사가 읽을 수 있는 `quiz_attempts`에서 개념별 최신 시도가 오답인 개수로 직접 계산한다.
- **이름 표시는 빈 문자열도 처리한다.** `display_name`이 `""`인 계정이 있어서 `?? "(이름 없음)"`은 빈 줄로
  렌더링됐다. `?.trim() || "(이름 없음)"`로 빈 문자열까지 걸러야 한다.
- **비공개 Storage 객체(문항 그림 등)를 학생에게 보여줄 땐 접근 권한 확인 후 admin 클라이언트로 signed
  URL을 발급한다.** 학생은 교사 소유 `quiz-images` 객체에 storage RLS로 접근 못 하므로, 문항 조회 권한이
  RLS로 검증된 quiz API 안에서만 서명한다(`lib/quiz/image.ts`).

## 민감한 실제 파일로 테스트할 때

사용자가 실제 학교 파일 경로(예: `H:\...`)를 공유하며 테스트를 요청하면, **`public/`에 절대 복사하지
않는다**(배포되면 공개됨). 대신 `127.0.0.1`에 바인딩된 임시 Node http 서버를 띄워 그 파일 하나만
서빙하고, 브라우저에서 `fetch()`로 가져와 테스트한 뒤 서버를 종료하고 임시 스크립트를 삭제한다.

