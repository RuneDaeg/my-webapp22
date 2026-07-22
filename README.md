# 과제 채점 도우미

학생이 과제 파일(pdf/docx/hwpx/txt)을 제출하면, 교사가 채점 기준을 바탕으로 Google Gemini API로
AI 채점·피드백·"과목별 세부능력 및 특기사항" 초안을 생성하고 검토/공개할 수 있는 웹앱입니다.
그 밖에 평가계획 PDF 자동 분해, 클래스별 적응형 문제풀이(문제은행), 학생·교사 대시보드, 클래스 학습
분석, 공지, 관리자 교사계정 발급 기능이 있습니다.

Next.js(App Router) + Supabase(Postgres/Auth/Storage) + Google Gemini API로 만들어졌습니다.

---

# 다른 선생님이 "자기 것"으로 배포하는 방법

이 앱은 **학교마다(혹은 선생님마다) 각자 배포해서 쓰는 것을 권장**합니다. 그래야 학생 개인정보·데이터가
학교 안에만 머물고, Supabase/Gemini/Vercel 사용 한도와 비용도 각자 분리됩니다. 아래 순서대로 하면
됩니다. 무료 등급으로 시작할 수 있고, 사용량이 늘면 유료로 올리면 됩니다.

## 준비물 (계정 4개, 모두 무료 가입)

| 서비스 | 용도 | 주소 |
|---|---|---|
| GitHub | 코드 저장소 복제 | https://github.com |
| Supabase | 데이터베이스·로그인·파일저장 | https://supabase.com |
| Google AI Studio | Gemini API 키 (AI 채점) | https://aistudio.google.com/apikey |
| Vercel | 웹 배포(호스팅) | https://vercel.com |

## 1단계. 저장소 복제

GitHub에서 이 저장소를 **Fork**(우측 상단 Fork 버튼)하거나, 코드를 내려받아 본인 GitHub 저장소로
올립니다. 이후 Vercel이 이 저장소를 가져다 배포합니다.

## 2단계. Supabase 프로젝트 + 스키마 만들기

1. https://supabase.com/dashboard 에서 **New project** 생성. **리전(Region)은 학교와 가까운 곳**
   (예: Northeast Asia (Seoul))으로 고르면 빠릅니다. DB 비밀번호는 잘 보관하세요.
2. 프로젝트가 생성되면 **스키마(테이블·보안정책·저장소 버킷)를 적용**합니다. 두 방법 중 하나:

   **(A) SQL Editor에 직접 붙여넣기 — 가장 간단**
   Supabase Dashboard의 **SQL Editor**에서 `supabase/migrations/` 폴더의 `.sql` 파일들을
   **번호 순서대로**(0001 → 0002 → … → 0013) 하나씩 붙여넣고 실행하세요.

   **(B) Supabase CLI로 한 번에** (터미널이 편하면)
   ```bash
   # .env.local에 SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD를 채운 뒤
   set -a && source .env.local && set +a
   npx supabase link --project-ref <프로젝트-ref> --password "$SUPABASE_DB_PASSWORD"
   npx supabase db push        # 0001~0013 전부 순서대로 적용
   ```

   이 과정에서 테이블·RLS 보안정책과 함께 비공개 Storage 버킷
   (`criteria-files`, `submission-files`, `quiz-images`)이 자동 생성됩니다.
3. **로그인 설정 확인**: Dashboard → **Authentication → Providers → Email**. "Confirm email"이 켜져
   있으면 학생이 가입 후 이메일 인증을 해야 합니다. 이메일 발송(SMTP)을 따로 설정하지 않았다면 이 옵션을
   **꺼두는 편**이 편합니다(관리자가 만든 교사 계정은 인증 없이 바로 로그인됩니다).

## 3단계. 생성형 AI API 키 — 교사별로 앱 안에서 등록

이 앱의 AI 기능(채점·피드백·세특 초안·문항 추출·클래스 분석)은 **교사 각자가 본인 키로** 실행합니다.
서버에 공용 키를 넣지 않으므로, 배포 후 각 교사가 로그인해서 **계정 설정 → 생성형 AI API 키**에서
제공사와 키를 등록하면 됩니다. 세 제공사 중 하나를 고를 수 있습니다:

- **Google Gemini**: https://aistudio.google.com/apikey (기본값 `gemini-2.5-flash`)
- **OpenAI**: https://platform.openai.com/api-keys (기본값 `gpt-4o`)
- **Anthropic Claude**: https://console.anthropic.com/ (기본값 `claude-sonnet-5`)

키를 저장할 때 앱이 짧은 테스트 호출로 키·모델을 검증합니다. 키는 서버(`teacher_ai_credentials` 테이블)에만
저장되고 화면에 다시 표시되지 않습니다. **실제 여러 명이 쓸 거라면 각 제공사에 결제(billing)를 연결**하는
것을 권장합니다 — 무료 등급은 호출 한도가 낮아 PDF 채점을 몇 번 하면 금방 막힙니다.

## 4단계. Vercel에 배포

1. https://vercel.com 에 GitHub로 로그인 → **Add New → Project** → 1단계에서 만든 저장소 선택.
2. **Environment Variables**에 아래를 입력합니다 (값은 Supabase Project Settings → API). AI 키는
   여기 넣지 않습니다 — 배포 후 각 교사가 앱 안에서 등록합니다(3단계 참고):

   | 변수 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (**비공개**, 서버 전용) |

3. **Deploy**를 누르면 배포됩니다. 이후 나오는 주소(예: `https://내프로젝트.vercel.app`)가 접속 주소입니다.
4. (선택) **리전 맞추기**: `vercel.json`의 `regions`가 `bom1`(뭄바이)로 되어 있습니다. Supabase 리전을
   서울로 골랐다면 지연시간을 줄이기 위해 이 값을 서울과 가까운 값(예: `icn1`)으로 바꾸고 다시 배포하면
   좋습니다.

## 5단계. 첫 관리자(admin) 만들기 — 중요

보안상 **회원가입은 학생만** 됩니다(교사·관리자 계정은 관리자만 발급). 그래서 배포 직후엔 관리자가
없으니, 한 명을 수동으로 지정해야 합니다.

1. 배포된 사이트의 `/signup`에서 관리자로 쓸 이메일로 가입합니다(일단 학생으로 만들어집니다).
2. Supabase **SQL Editor**에서 아래를 실행해 그 계정을 관리자로 승격합니다
   (역할 변경을 막는 트리거를 잠깐 껐다 켭니다):
   ```sql
   alter table public.profiles disable trigger profiles_prevent_role_change;
   update public.profiles set role = 'admin'
     where id = (select id from auth.users where email = '관리자이메일@example.com');
   alter table public.profiles enable trigger profiles_prevent_role_change;
   ```
3. 로그아웃 후 다시 로그인하면 관리자 화면(`/admin`)이 열립니다.

## 6단계. 운영

- 관리자가 `/admin`에서 **교사 계정을 발급**합니다. 임시 비밀번호가 화면에 한 번 표시되니 해당 교사에게
  전달하세요. 교사는 첫 로그인 후 `/account`(우측 상단 이름 클릭)에서 비밀번호를 바꾸면 됩니다.
- 학생은 `/signup`에서 직접 가입하고, 교사가 준 **클래스 참여 코드**로 클래스에 들어갑니다.

---

## 역할 구조 요약

- **관리자(admin)**: 교사 계정 발급. 첫 관리자는 위 5단계로 부트스트랩.
- **교사(teacher)**: 클래스·과제·문제은행 운영, AI 채점 검토/공개, 대시보드·분석·공지.
- **학생(student)**: 자율 가입 + 참여 코드로 클래스 입장, 과제 제출, 문제 풀이.

## 로컬에서 개발/실행 (선택)

```bash
cp .env.local.example .env.local   # 값 채우기
npm install
npm run dev                        # http://localhost:3000
```

마이그레이션 관리(선택): 이미 SQL Editor로 수동 적용한 게 있다면 `npx supabase migration list`로 로컬/원격
상태를 비교하고, 적용됐지만 CLI가 모르는 버전은 `npx supabase migration repair --status applied <버전>`으로
기록만 맞춥니다(재실행하지 않음). 새 마이그레이션은 기존 파일을 고치지 말고 새 번호로만 추가합니다.

## 알려진 한계

- **HWPX 텍스트 추출**은 자체 파서로 문단/표 텍스트를 뽑지만 표의 행/열 구조·이미지 내용은 반영하지
  못합니다. 구버전 바이너리 `.hwp`는 미지원(`.hwpx`만 — 한글에서 "다른 이름으로 저장" → HWPX).
- **PDF 학생 제출물·평가계획·문제지**는 텍스트 추출 대신 원본을 통째로 Gemini에 보내 그림·표까지
  인식합니다. 다만 Vercel 서버리스 함수의 요청 본문 기본 제한(약 4.5MB)보다 큰 PDF는 막힐 수 있습니다.
- 재제출 시 이전 제출 파일·AI 채점 결과는 덮어써집니다(이력 관리 없음).
- 세특 초안은 교사만 볼 수 있고 학생에게는 공개되지 않습니다.
