# AGENTS.md

MySchoolMate 작업 지침(AGENTS). Next.js 16 + Playwright + Prisma + Gemini + NextAuth를 기준으로 정리합니다.

## 프로젝트 구조 (요약)

### app 레이어
- `src/app/page.tsx`: 메인 대시보드
- `src/app/settings/page.tsx`: 사용자 프로필 설정
- `src/app/planning/page.tsx`: 트랙/커리큘럼 UI
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth 엔드포인트
- `src/app/api/notices/route.ts`: 공지 목록 조회 + 자동 갱신(쿼리 토글)
- `src/app/api/notices/crawl/route.ts`: 수동 공지 크롤링 트리거
- `src/app/api/briefing/route.ts`: 오늘의 AI 브리핑
- `src/app/api/curriculum/route.ts`: 커리큘럼 데이터 조회
- `src/app/api/menu/route.ts`: 식단 조회/수동 크롤링
- `src/app/api/user/profile/route.ts`: 사용자 프로필 CRUD
- `src/app/api/user/session/route.ts`: 세션 기반 프로필 조회/신규 생성
- `src/app/api/alerts/email/*`: 테스트 알림 / 브리핑 메일 발송
- `src/app/api/crawl/route.ts`, `src/app/api/debug/reset/route.ts`: 운영/진단용
- `src/app/layout.tsx`, `src/app/favicon.ico`, `src/app/globals.css`

### core 라이브러리
- `src/lib/crawler.ts`: 공지 크롤러 + AI 분석 파이프라인
- `src/lib/noticeAutoCrawler.ts`: 자동 크롤러 락/상태 관리
- `src/lib/gemini.ts`: 브리핑/요약/분석/포맷 함수
- `src/lib/deadlineExtractor.ts`: 마감일 추출 유틸
- `src/lib/crawlMenu.ts`: 식단 크롤링
- `src/lib/curriculum-crawler.ts`: 커리큘럼 크롤링
- `src/lib/prisma.ts`, `src/lib/sessionUser.ts`, `src/lib/userProfileResolver.ts`: DB/세션/사용자 조회 공용
- `src/lib/emailSender.ts`, `src/auth.ts`: 알림/인증 공용
- `src/lib/curriculum.json`, `src/data/notices.json`: 정적 데이터 소스

### 런타임 유틸
- `components`(UI): 페이지를 구성하는 shadcn/ui 기반 컴포넌트
- `scripts/*.ts`: 배치/점검용 헬퍼
- `tests/*.ts`: Playwright + 회귀 테스트
- `prisma/schema.prisma`: 모델 정의

## 0) 기본 준비

```bash
npm install
```

`.env`는 README의 항목을 맞춘 뒤 실행합니다.

## 1) 의존성/코드 생성 + DB 준비

```bash
npx prisma generate
npx prisma db push
```

- `prisma/schema.prisma` 변경 시 실행.
- 기존 DB 상태 점검이 필요하면 `npx prisma db pull` 후 검토.

## 2) 앱 실행/검증

```bash
npm run dev
npm run build
npm run start
npm run lint
```

- 평소 개발은 `npm run dev`
- 배포/배포 전 점검은 `npm run build` + `npm run start`

## 3) 공지 파이프라인 운영

```bash
npx tsx scripts/run_crawl.ts
npx tsx scripts/verify_db.ts
npx tsx scripts/check_categories.ts
```

- 공지 수집/갱신
- 수집 이후 DB 정합성(카운트/샘플/프로필 연동) 확인
- 카테고리/샘플 점검

### 주의
`tsx` 바이너리가 없을 경우 아래를 먼저 실행하고 재시도:

```bash
npm i -D tsx
```

## 4) 중복 정리/데이터 정돈

```bash
npx tsx scripts/check-duplicates.ts
npx tsx scripts/cleanup-duplicates.ts
```

- `check-duplicates.ts`: 제목 기준 중복 확인
- `cleanup-duplicates.ts`: URL 정규화 기반 중복 제거
- 운영 DB에서 실행할 때는 반드시 백업 또는 즉시 롤백 플랜을 준비

## 5) 크롤링/파서 디버그

```bash
npx tsx scripts/inspect_notice.ts
npx tsx scripts/debug_curriculum.ts
npx tsx test-crawl.ts
npx tsx test-crawler.ts
npx tsx src/lib/test-gemini.ts
```

- 공지 페이지 구조 변경 대응 시 HTML/스크린샷 및 추출 결과를 먼저 점검
- Gemini 동작 문제는 `src/lib/test-gemini.ts`로 API 응답성 확인

## 6) API 점검 (실행 중인 앱 기준 localhost:3000)

```bash
curl "http://localhost:3000/api/notices?autoCrawl=0"
curl -X POST "http://localhost:3000/api/notices/crawl"
curl -X POST "http://localhost:3000/api/menu"
curl "http://localhost:3000/api/user/profile"
curl -X POST "http://localhost:3000/api/user/profile" -H "Content-Type: application/json" -d '{"grade":3,"income":7,"gpa":3.9}'
curl -X POST "http://localhost:3000/api/alerts/email/test" -H "Content-Type: application/json" -d '{}'
```

## 7) 테스트/회귀

```bash
npx playwright test
npx playwright test tests/regression.deadline-extraction.spec.ts
npx playwright test tests/regression.profile-notice.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/regression.profile-notice.spec.ts
npx playwright show-report
```

- 기본 회귀는 `tests/regression.*` 우선
- 마감일 파서 케이스는 `tests/regression.deadline-extraction.spec.ts`

## 8) 운영 전 체크리스트

```bash
npm run lint
npm run build
npx playwright test
```

에러 발생 시 `check-duplicates`, `verify_db`, `inspect_notice`, `crawl` 흐름을 순서대로 점검합니다.
