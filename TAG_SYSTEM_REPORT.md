# Tag system (N:M) – 작업 리포트

브랜치: `feature/tag-system`

## 한 줄 요약
공지에 **정식 태그(N:M)** 모델을 추가하고, 크롤러가 공지 본문/제목 기반으로 **저비용(키워드/regex)** 태그를 자동 부여하도록 붙였습니다. `/api/notices`에서 태그 필터 파라미터도 지원합니다.

## 1) DB/Prisma 변경
- `prisma/schema.prisma`
  - `NoticeTag` (slug unique)
  - `NoticeTagOnNotice` (join, @@id([noticeId, tagId]))
  - `Notice`에 `tags: NoticeTagOnNotice[]` 관계 추가
- 마이그레이션: `npx prisma db push` 로 `dev.db` 동기화 완료

## 2) 태그 추출 로직(토큰 절약)
- `src/lib/noticeTags.ts`
  - 태그 정의(슬러그/표시명/키워드) 기반으로 title/body/category에서 매칭
  - LLM 호출 없음 (완전 규칙 기반)

## 3) 크롤러에 태그 저장
- `src/lib/crawler.ts`
  - 공지 분석 후 `extractNoticeTagSlugs()`로 태그 slugs 생성
  - Notice upsert 시 nested write로 태그를 `connectOrCreate` + join 생성

## 4) API: 태그 포함 + 태그 필터
- `src/app/api/notices/route.ts`
  - response에 `tags: string[]`(tag slug) 포함
  - query:
    - `?tags=scholarship,intern&tagMode=any|all`
    - `any`: 하나라도 포함
    - `all`: 전부 포함(서버에서 후처리 필터)

## 5) UI: 태그 표시
- `src/app/page.tsx`
  - 공지 카드/다이얼로그에 `#slug` 형태로 태그 표시

## 사용법
1) 크롤 한번 돌리기
- UI에서 수동 크롤 버튼 또는 API `POST /api/notices/crawl`

2) 태그 필터 조회
- 예) `/api/notices?tags=scholarship,course&tagMode=all&autoCrawl=0`

## 남은 할 일(아침에 바로 이어서)
- 대시보드에 태그 필터 UI(칩/멀티선택/AND-OR 토글) 붙이기
- slug를 한국어 label로 매핑해서 UI에 예쁘게 표시(지금은 #slug)
- 기존 DB 공지들에 대한 태그 백필(한 번만 돌리는 작업)

## 참고
`npm run build`는 현재 태그 작업 때문이 아니라 **기존 코드베이스의 TypeScript 오류들이 남아있어서** 완전 green 상태는 아닙니다(예: adminActionGuard 쪽 nullability 등). 태그 기능 자체는 별도 모듈로 분리해둬서, TS 정리랑 병행해서 안정화하면 됩니다.
