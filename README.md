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
| **🔔 실시간 공지 크롤링** | 학과 게시판(학사/장학, 일반, 취업, 소식)에서 최신 공지사항을 자동 수집 |
| **🤖 AI 요약 브리핑** | Gemini 3.0 Flash를 활용하여 오늘의 중요 공지를 한눈에 파악 |
| **👤 맞춤형 필터링** | 내 학년, 소득분위, 학점에 맞는 장학금/공지만 필터링 |
| **📊 스마트 분석** | 장학금 유형, 지원 마감일, 신청 자격 등을 AI가 자동 추출 |
| **🗺️ 커리큘럼 플래너** | 전공 트랙별 수강 계획 수립 지원 |

---

## 🖼️ 주요 화면

### 메인 대시보드
- **AI 오늘의 브리핑**: 사용자 프로필 기반 맞춤 소식 요약
- **공지사항 캘린더**: 카드/리스트 뷰, 카테고리 필터, 검색 지원
- **매칭 태그 표시**: 내 조건에 맞는 장학금은 ✅ 표시

### 공지 상세 뷰
- AI 요약 + 원문 마크다운 렌더링
- 표, 링크 등 서식 자동 정리

### 설정 페이지
- 학년, 소득분위, 학점, 전공 트랙 설정
- 저장 시 필터에 자동 적용

---

## 🛠️ 기술 스택

### Frontend
- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS 4** + Framer Motion
- **shadcn/ui** (Radix UI 기반 컴포넌트)

### Backend & AI
- **Prisma ORM** + SQLite (로컬 DB)
- **Playwright** (서버사이드 웹 크롤링)
- **Google Gemini 3.0 Flash** (요약, 정보 추출)
- **Gemini 2.0 Flash** (콘텐츠 포맷팅)

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
```

### 3. 데이터베이스 초기화
```bash
npx prisma db push
```

### 4. 개발 서버 실행
```bash
npm run dev
```

→ http://localhost:3000 에서 확인

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
│   │       ├── notices/        # 공지 CRUD
│   │       ├── briefing/       # AI 브리핑 생성
│   │       ├── crawl/          # 크롤러 트리거
│   │       ├── curriculum/     # 트랙/과목 조회
│   │       └── user/           # 사용자 프로필
│   ├── components/             # UI 컴포넌트
│   │   ├── ui/                 # shadcn/ui 기본 컴포넌트
│   │   ├── NavBar.tsx          # 동적 네비게이션
│   │   ├── NoticeCard.tsx      # 공지 카드
│   │   └── LoadingOverlay.tsx  # 로딩 애니메이션
│   └── lib/
│       ├── crawler.ts          # Playwright 크롤러
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
| GET | `/api/curriculum` | 전공 트랙 목록 조회 |

---

## 🗄️ 데이터 모델

### Notice (공지사항)
공지 원문 + AI 분석 결과 저장
- `title`, `url`, `date`, `category`
- `summary` (AI 요약)
- `minGrade`, `maxIncome`, `minGpa` (자격 조건)
- `scholarshipType`, `deadline` (장학 정보)

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

---

## 📜 라이선스

이 프로젝트는 개인 프로젝트로 운영됩니다.

---

<p align="center">
  Made with ❤️ for CBNU ICE Students
</p>
