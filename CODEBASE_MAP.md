# MySchoolMate Codebase Map (quick)

> 목표: "어디에 뭐가 있는지" 한 번에 찾게 해주는 지도 + 지금 보이는 '태그'가 실제로 뭔지 정리.

## TL;DR
- 지금 UI에서 보이는 "태그"는 **(1) 카테고리 배지** + **(2) scholarshipType 배지** + **(3) 조건 매칭(학년 매칭 등) 배지**가 대부분임.
- Prisma `Notice` 모델에는 **tags 컬럼/테이블이 없음** → 즉, "태그 기반 필터링"을 제대로 하려면 **DB 레벨 태그 모델링부터** 추가하는 게 정석.

---

## 1) High-level architecture

### Data flow
1) (수동/자동) 크롤링 트리거
- API: `POST /api/notices/crawl`
- 내부: `src/lib/noticeAutoCrawler.ts`가 락/쿨다운/상태 관리

2) 크롤링
- `src/lib/crawler.ts`
  - Playwright로 게시판 목록/상세를 수집
  - DB upsert/update
  - `processed`가 false인 것 위주로 AI 처리 흐름을 태우는 구조가 맞음(현재 구현은 일부 refresh 로직 존재)

3) AI 분석
- `src/lib/gemini.ts`
  - 요약(summary)
  - 조건 추출(minGrade/maxIncome/minGpa/scholarshipType 등)
  - deadline 파싱은 `src/lib/deadlineExtractor.ts` 도움

4) 저장
- Prisma + SQLite
- `src/lib/prisma.ts`

5) 프론트 렌더
- `src/app/page.tsx` (대시보드 메인: 매우 큼)
- `/api/notices`에서 공지 리스트 로드

---

## 2) Prisma models (핵심)
- `prisma/schema.prisma`

### Notice
- `minGrade, maxIncome, minGpa, scholarshipType, deadline, processed, isPinned`
- **tags 없음**

### UserProfile
- `grade, income, gpa, trackId` + 이메일 알림 설정 + `dashboardState`(문자열 인코딩)

---

## 3) API Routes (Next.js App Router)
경로: `src/app/api/**/route.ts`

### Notices
- `GET /api/notices` → 공지 목록 + autoCrawler 상태
  - 파일: `src/app/api/notices/route.ts`
- `POST /api/notices/crawl` → 크롤 실행(운영 토큰 가드)
  - 파일: `src/app/api/notices/crawl/route.ts`

### User
- `GET /api/user/session` → 세션/프로필 확인
- `GET/POST /api/user/profile` → 프로필 + dashboardState 동기화

### Briefing / Email
- `GET /api/briefing` → 일일 브리핑 생성/캐시
- `POST /api/alerts/email/test` / `POST /api/alerts/email/digest`

### Planning / Menu
- `/api/curriculum`, `/api/planning/*`, `/api/menu`

---

## 4) UI에서 보이는 "태그"의 실체

### (A) 카테고리 배지
- 위치: `src/app/page.tsx` NoticeCard 렌더
- `notice.category` 기반으로 '학사/장학/취업/등록금' 등으로 표시

### (B) scholarshipType 배지
- 위치: `src/app/page.tsx` ("Special Tags")
- DB 필드: `Notice.scholarshipType`

### (C) 조건 매칭 배지
- 예: "학년 매칭" 같은 표시
- 로직: `filterProfile.grade`와 `notice.minGrade` 비교

즉, 지금의 "태그"는 **정식 태그 시스템이 아니라**, 특정 필드/상태에서 나온 뱃지 UI에 가까움.

---

## 5) "태그 기반 필터링"을 제대로 하려면 (추천 설계)

### Option 1) 정석 (추천)
- Prisma에 N:M 태그 모델 추가
  - `NoticeTag { id, name, slug }`
  - `NoticeTagMap { noticeId, tagId }`
- `/api/notices?tags=a,b&tagMode=any|all` 같은 쿼리 제공
- 크롤러/AI 분석에서 태그를 추출해 DB에 저장

### Option 2) 빠른 해킹(저비용)
- `Notice`에 `tagsJson`(string) 하나 추가해서 JSON 배열로 저장
- 장점: 구현 빠름
- 단점: 쿼리/정규화/중복관리 불편

---

## 6) 지금 당장 다음 액션(내가 할 수 있는 것)
1) 코드베이스 전체에서 "태그"가 실제로 어디서 생성되는지 추적
   - 현재 확인 기준으로는 `Notice` 모델에 tags가 없어서, **프론트 표시용 뱃지**일 가능성이 높음
2) 태그 모델 추가(Option1 or Option2) + 마이그레이션
3) 크롤러에서 태그 추출
   - 1차: regex/키워드 (저비용)
   - 2차: 애매한 것만 LLM
4) 대시보드에 태그 필터 UI 추가
   - 태그 칩 + AND/OR + 저장된 프리셋

---

## 7) 파일별 역할 빠른 링크
- UI 메인 대시보드: `src/app/page.tsx`
- 공지 API: `src/app/api/notices/route.ts`
- 크롤러: `src/lib/crawler.ts`
- 자동크롤 상태/락: `src/lib/noticeAutoCrawler.ts`
- AI 분석: `src/lib/gemini.ts`
- deadline 파서: `src/lib/deadlineExtractor.ts`
- Prisma client: `src/lib/prisma.ts`
- 운영 토큰 가드: `src/lib/adminActionGuard.ts`
- 설정 페이지: `src/app/settings/page.tsx`
- 커리큘럼 플래너: `src/app/planning/page.tsx` + `src/lib/planningRequirements.ts`
