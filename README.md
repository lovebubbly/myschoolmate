# 🎓 MySchoolMate - CBNU ICE AI 학사비서

<p align="center">
  <strong>충북대학교 정보통신공학부 학생을 위한 AI 기반 맞춤형 학사 알림 서비스</strong>
</p>

---

## 📌 서비스 소개

**MySchoolMate**는 충북대학교 정보통신공학부 학생들을 위한 스마트 학사 비서입니다.

학과 공지사항을 실시간으로 크롤링하고, **Google Gemini AI**를 활용하여 개인 맞춤형 정보를 제공합니다.

### 🎯 핵심 기능

| 기능 | 설명 |
|------|------|
| **🔔 실시간 공지 크롤링** | 학과 게시판(학사/장학, 일반, 취업, 소식)에서 최신 공지사항을 자동 수집 (오래된 경우 자동 갱신) |
| **🤖 AI 맞춤 브리핑** | Gemini AI를 활용하여 사용자 프로필 기반 맞춤형 소식 브리핑 |
| **👤 스마트 필터링** | 학년, 소득분위, 학점 기반 장학금/공지 자동 필터링 |
| **📊 AI 분석** | 장학금 유형, 지원 마감일, 신청 자격 등을 AI가 자동 추출 |
| **📌 중요 공지 핀 고정** | 상단 고정 공지를 접이식 섹션으로 분리하여 관리 |
| **🔔 인앱 알림함** | 신규 공지 및 마감 임박 공지를 대시보드 알림함에서 확인 |
| **🗺️ 커리큘럼 플래너** | 전공 트랙별 수강 계획 수립 지원 |
| **🍽️ 주간 식단표** | 교내 식당(한빛/별빛/은하수) 주간 메뉴 및 운영 시간 확인 |

---

## ✨ 주요 특징

### 🎨 모던 UI/UX
- **다크/라이트 모드** 지원
- **Framer Motion** 기반 부드러운 애니메이션
- **반응형 디자인** (모바일/태블릿/데스크톱)
- **드래그 앤 드롭** 위젯 순서 변경
- **Lottie 애니메이션** 로딩 효과
- **3D 카드 효과** (TiltCard)

### 🤖 AI 기능
- **개인 맞춤형 브리핑**: 사용자 학년, 소득분위, 학점을 고려한 맞춤 소식
- **공지 자동 요약**: 긴 공지글을 핵심 내용으로 요약
- **마감일 자동 추출**: AI가 공지 본문에서 마감일 자동 파싱
- **자격 조건 분석**: 장학금 신청 조건 자동 분석

### 📱 사용자 경험
- **카드/리스트 뷰** 전환
- **카테고리 필터** (전체/학사/장학/일반/취업/뉴스)
- **검색 기능** 제목/본문 통합 검색
- **매칭 태그** 표시 (내 조건에 맞는 장학금 ✅)
- **무한 스크롤** 대신 "더 보기" 버튼으로 성능 최적화

---

## 🖼️ 주요 화면

### 메인 대시보드
- **AI 오늘의 브리핑**: 사용자 프로필 기반 맞춤 소식 요약
- **공지사항 그리드**: 카드/리스트 뷰, 카테고리 필터, 검색 지원
- **핀 고정 공지**: 중요 공지 접이식 섹션
- **매칭 태그 표시**: 내 조건에 맞는 장학금은 ✅ 표시

### 공지 상세 뷰
- AI 요약 + 원문 마크다운 렌더링
- 표, 링크, 첨부파일 등 서식 자동 정리
- 모달 내 테이블 가로 스크롤 지원

### 식단표 위젯
- 한빛/별빛/은하수 식당 메뉴 실시간 조회
- 아침/점심/저녁 자동 추천 및 날짜 이동 기능

### AI 마스코트
- 인터랙티브 마스코트 애니메이션
- 사용자 인사 및 상태 표시

---

## 🛠️ 기술 스택

### Frontend
- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS 4** + Framer Motion
- **shadcn/ui** (Radix UI 기반 컴포넌트)
- **Lottie React** (애니메이션)
- **React Markdown** (마크다운 렌더링)

### Backend & AI
- **Prisma ORM** + SQLite (로컬 DB)
- **Playwright** (서버사이드 웹 크롤링)
- **Google Gemini 2.0 Flash** (요약, 정보 추출, 브리핑)

### 데이터 흐름
```
[충북대 정보통신공학부 게시판] 
        ↓ Playwright 크롤링
[원문 데이터] 
        ↓ Gemini AI 분석
[요약 + 학년/소득/마감일 추출]
        ↓ Prisma → SQLite 저장
[Dashboard 렌더링 + 사용자 필터링]
```

---

## 🚀 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 파일 생성:
```env
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY="your-gemini-api-key"
AUTH_SECRET="your-random-long-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
# Optional
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="smtp-username"
SMTP_PASS="smtp-password"
SMTP_FROM="MySchoolMate <no-reply@example.com>"
ADMIN_ACTION_TOKEN="set-a-strong-token-for-admin-actions"
EMAIL_ALERT_ADMIN_TOKEN="set-only-if-you-need-scope-all"
# Optional: SMTP_PORT=465이면 자동 secure, 또는 SMTP_SECURE=true
```

소셜 로그인 키를 아직 설정하지 않아도 앱은 익명 세션 모드로 동작합니다.
SMTP를 설정하지 않아도 메일 API는 dry-run 모드로 동작합니다.

### 3. 데이터베이스 초기화
```bash
npx prisma db push
```

### 4. 개발 서버 실행
```bash
npm run dev
```

→ http://localhost:3000 에서 확인

### 5. 배포 전/운영 점검
```bash
BASE_URL=http://localhost:3000 ADMIN_TOKEN=<ADMIN_ACTION_TOKEN> ./scripts/local-preflight.sh
```
- 운영자용 상세 점검은 `OPERATIONS.md`를 확인하세요.
- 운영자 액션 API(`/api/notices/crawl`, `/api/crawl`, `/api/debug/reset`)는 `x-admin-token`, `adminToken`, `admin_action_token` 중 하나의 인증을 필요로 합니다.
- 이메일 테스트/발송 API는 잘못된 입력 시 400 반환, 실패 사유 요약 응답, SMTP 미설정 시 dry-run 동작을 보장합니다.

### 6. 운영 로그 체크
- 관리 API 거부 로그: `source`, `ip`, `route`, `reason`
- 알림 실패 로그: `userId`, `email`, `route`, `reason`
- 크롤러 상태: `autoCrawler.lastFailureReason`, `autoCrawler.lastSuccessAt`, `autoCrawler.retryCount`

---

## 📂 프로젝트 구조

```
myschoolmate/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 메인 대시보드
│   │   ├── settings/           # 사용자 설정 페이지
│   │   ├── planning/           # 커리큘럼 플래너
│   │   └── api/                # API Routes
│   │       ├── notices/        # 공지 CRUD + 크롤링
│   │       ├── briefing/       # AI 브리핑 생성
│   │       ├── curriculum/     # 트랙/과목 조회
│   │       └── user/           # 사용자 프로필
│   ├── components/             # UI 컴포넌트
│   │   ├── ui/                 # shadcn/ui 기본 컴포넌트
│   │   ├── NavBar.tsx          # 동적 네비게이션
│   │   ├── CafeteriaWidget.tsx # 식단표 위젯
│   │   ├── Mascot.tsx          # AI 마스코트
│   │   ├── TiltCard.tsx        # 3D 카드 효과
│   │   ├── LottieAnimations.tsx# Lottie 애니메이션
│   │   ├── ModeToggle.tsx      # 테마 토글
│   │   └── LoadingOverlay.tsx  # 로딩 오버레이
│   └── lib/
│       ├── crawler.ts          # Playwright 크롤러
│       ├── crawlMenu.ts        # 식단 크롤러
│       ├── gemini.ts           # Gemini AI 래퍼
│       └── prisma.ts           # Prisma 클라이언트
├── prisma/
│   └── schema.prisma           # DB 스키마
└── public/                     # 정적 파일
```

---

## 📡 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/notices` | 저장된 공지 목록 조회 |
| POST | `/api/notices/crawl` | 새 공지 크롤링 실행 |
| GET | `/api/briefing` | AI 브리핑 생성 |
| GET/POST | `/api/user/profile` | 사용자 프로필 조회/저장 |
| POST | `/api/alerts/email/test` | 메일 채널 테스트 발송 (SMTP 없으면 dry-run) |
| POST | `/api/alerts/email/digest` | 오늘 브리핑 메일 발송 (기본 `scope=me`) |
| GET | `/api/curriculum` | 전공 트랙 목록 조회 |
| GET | `/api/menu` | 식단 정보 조회 |

---

## 🗄️ 데이터 모델

### Notice (공지사항)
공지 원문 + AI 분석 결과 저장
- `title`, `url`, `date`, `category`
- `summary` (AI 요약)
- `content` (포맷팅된 본문)
- `minGrade`, `maxIncome`, `minGpa` (자격 조건)
- `scholarshipType`, `deadline` (장학 정보)
- `isPinned` (상단 고정 여부)

### UserProfile (사용자 프로필)
맞춤 필터링을 위한 개인 정보
- `grade` (학년)
- `income` (소득분위)
- `gpa` (학점)
- `trackId` (전공 트랙)

### Track & Course (커리큘럼)
수강 계획을 위한 전공 트랙 및 교과목 정보

---

## 🔮 로드맵

- [ ] 푸시 알림 (신규 장학금 도착 시)
- [ ] 이메일/카카오톡 알림 연동
- [ ] 다학과 확장 지원
- [ ] 모바일 PWA 최적화
- [ ] 사용자 인증 (next-auth)
- [ ] 시간표 연동

---

## 📜 라이선스

이 프로젝트는 개인 프로젝트로 운영됩니다.

---

<p align="center">
  Made with ❤️ for CBNU ICE Students
</p>
