# MySchoolMate 운영자 가이드 (즉시 배포 안정성 패치 반영판)

이 문서는 최근 배포 전반의 안정성 패치(보안 가드, 알림 신뢰성, 크롤러 가시성, 프로필 동기화) 기준으로 작성됩니다.

## 1) 운영 목표

- 운영 API(수동 크롤/리셋/알림 수동 트리거) 무단 실행 방지
- 알림 발송 실패 원인 추적성 확보
- 대시보드 상태 동기화(읽음/위젯) 부분 적용으로 유저 경험 흔들림 최소화
- 크롤러 상태 점검을 API에서 즉시 확인 가능하게 유지

## 2) 운영 환경 준비

- 필수 실행 조건
  - Node.js 런타임 정상
  - Prisma DB 연결 가능 (`DATABASE_URL`)
  - 필요 시 SMTP 자격 증명
- 권장 환경 변수
  - `ADMIN_ACTION_TOKEN`: 운영 API 가드용 최우선 토큰
  - `EMAIL_ALERT_ADMIN_TOKEN`: 브리핑 메일 전체 발송(`scope=all`) 제어
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `SMTP_SECURE` (옵션), `SMTP_PORT=465`면 기본 secure로 동작
- 배포 전 점검
  - `npm run lint`
  - `npm run build`
  - `npm run start`(운영 유사 모드에서 5분 이상 가동 안정성 확인)

## 3) 보안 가드 적용 엔드포인트

- 적용 대상:
  - `/api/notices/crawl`
  - `/api/crawl`
  - `/api/debug/reset`
- 허용 방식(우선순위)
  - Header: `x-admin-token: <ADMIN_ACTION_TOKEN>`
  - Query: `?adminToken=<ADMIN_ACTION_TOKEN>`
  - Cookie: `admin_action_token=<ADMIN_ACTION_TOKEN>`
- 미설정 동작
  - `NODE_ENV !== production` 또는 로컬 IP(`127.0.0.1`, `::1`)이면 허용
  - 운영 프로덕션에서 미설정이면 401
- 실패 응답
  - 401: 토큰 없음 / 토큰 미설정(운영)
  - 403: 토큰 불일치
- 로그 필드(운영 이슈 추적용)
  - `source`, `ip`, `route`, `reason`

## 4) 알림 파이프라인(신뢰성) 체크리스트

- 엔드포인트: `/api/alerts/email/digest`
- SMTP 실패 동작
  - 실패 사유를 응답 `summary.failedReasons` 및 `summary.failed`에 반영
  - 기존 dry-run 모드 유지( SMTP 미설정 시)
  - 각 실패는 `console.warn`에 userId/email/route/reason 기록
- 강제 발송
  - `force=true`를 요청 바디에 명시해야 강제 발송 허용
  - 동일 사용자 중복 발송 방지는 `force`가 없으면 유지

## 5) 브리핑 테스트 API

- 엔드포인트: `/api/alerts/email/test`
- 입력 검증
  - body가 객체가 아니면 400
  - `email` 값이 비어 있거나 형식이 틀리면 400
- 동작 규칙
- 기존 프로필/세션 폴백 유지(요청 email 미제공 시)
- SMTP 없는 환경은 dry-run

## 6) 사용자 프로필 API 강화

- 엔드포인트: `/api/user/profile`
- 입력 검증
  - 잘못된 바디/타입/범위 즉시 400 반환
- 최소 스키마 동기화 지원(기존 localStorage 호환 유지)
  - `readNoticeIds: number[]`
  - `widgetOrder: string[]`
  - `enabledWidgets: { inbox:boolean, cafeteria:boolean, notices:boolean }`

## 7) 크롤러 상태 가시성

- Playwright 실행 원칙: **headless 우선** (필요해서 headful로 띄울 때만 명시적으로 `headless: false` 사용)

- 내부 상태 노출: `/lib/noticeAutoCrawler.ts`의 상태에 아래 값이 포함됨
  - `lastFailureReason`
  - `retryCount`
  - `lastSuccessAt`
- API 노출: `/api/notices` 응답의 `autoCrawler` 및 `/api/notices/crawl` 응답의 `autoCrawler`에서 확인
- 대시보드 표시
  - `수집 중`, `최신 데이터 갱신 실패`, `최근 성공 시각`, `미수집` 텍스트로 노출

## 8) 대시포트/대시보드 동기화 동작

- 클라이언트 localStorage 백업(기기별) 유지
- 프로필 응답에 `dashboardState`가 있으면 우선 반영
- 변경 이벤트 500ms 디바운스 전송
  - `readNoticeIds` 변경
  - `widgetOrder` 변경
  - `enabledWidgets` 변경

## 9) 운영 점검용 최소 cURL

- 보안 가드 상태
  - `curl -i -X POST "https://<host>/api/notices/crawl"`
  - `curl -i -X GET "https://<host>/api/crawl"`
  - `curl -i -X POST "https://<host>/api/debug/reset"`
- 정상 토큰 검증(예시)
  - `curl -i -X POST "https://<host>/api/notices/crawl?adminToken=<ADMIN_ACTION_TOKEN>"`
- 사용자/알림 API
  - `curl -i -X POST "https://<host>/api/user/profile" -H "Content-Type: application/json" -d '{"grade":3,"income":7,"gpa":3.9}'`
  - `curl -i -X POST "https://<host>/api/alerts/email/test" -H "Content-Type: application/json" -d '{"email":"you@example.com"}'`
  - `curl -i -X POST "https://<host>/api/alerts/email/digest" -H "Content-Type: application/json" -d '{"scope":"all","force":false}'`
- 상태 확인
  - `curl -i "https://<host>/api/notices"`

### 로컬 원클릭 점검 스크립트

- `scripts/local-preflight.sh`를 실행하면 상기 점검 항목을 한 번에 확인할 수 있습니다.
  - `ADMIN_TOKEN=<ADMIN_ACTION_TOKEN> BASE_URL=http://localhost:3000 ./scripts/local-preflight.sh`
- 권장: `jq`를 설치하면 JSON 응답 요약 비교까지 상세 로그를 확인할 수 있습니다.

## 10) 장애 대응(runbook)

- 토큰 관련 401/403 반복
1. 환경변수 `ADMIN_ACTION_TOKEN` 재확인
2. 프론트/배포체인에서 헤더/쿼리/쿠키 주입 경로 점검
3. 요청 로그에서 `source, route, ip, reason` 순 추적
- 알림 실패 급증
1. `/api/alerts/email/digest` 응답의 `summary.failed`/`failedReasons` 확인
2. SMTP 자격 증명, 네트워크, 발송 제한(IP/송신 제한) 점검
3. dry-run 동작으로 우회 가능 여부 확인 (`smtpConfigured` 필드)
- 크롤러 미동작
1. `/api/notices` 응답 `autoCrawler.lastFailureReason` 확인
2. `retryCount` 급증 시 백그라운드 잡/DB 연결/사이트 접속성 점검
3. 수동 트리거(`/api/notices/crawl`)로 재시작 후 응답 status 200 확인
- 롤백 전략(최소 영향)
  - 환경 변수만으로 가동 중단 대응(알림/관리 토큰/SMTP)
  - 문제가 크롤러이면 배포를 되돌리되 `dashboardState` 동기화 필드는 그대로 둔 상태에서 최소 기능만 유지 가능

## 11) 배포 직후 10분 체크

- `/api/notices` 호출 1회: `autoCrawler` 응답 포함 여부 확인
- 403/401이 뜨지 않는 토큰 기반 호출은 허용 가능한지 1회 확인
- `/api/user/profile` GET/POST 400/200 동작 확인
- `/api/alerts/email/test` 잘못된 이메일 400 확인
- `/api/alerts/email/digest`에서 `summary.failedReasons` 및 실패건 수가 수치화되는지 확인

## 12) DOM 드리프트 체크

- 수동 캡처 스크립트: `npx tsx scripts/dom_fingerprint.ts`
- 상태 조회: `GET /api/admin/dom-fingerprint`
- 강제 실행: `POST /api/admin/dom-fingerprint/run`
- 해석 가이드
  - `changed: true`면 이전 해시 대비 DOM 구조 변화 가능성
  - `selectorHealth`의 `hasTable/hasSubjectLink/rowCount` 등으로 셀렉터 깨짐 여부 확인
  - `sampleTitle`은 페이지 정상 로드 여부 sanity-check 용
- 운영 API 호출 시 기존 `ADMIN_ACTION_TOKEN` 가드 규칙 동일 적용

## 13) 운영 스냅샷(원샷 JSON)

- 로컬 스크립트: `npx tsx scripts/ops_snapshot.ts`
- 상태 조회(API): `GET /api/admin/ops-snapshot`
- 포함 내용
  - DB: `noticeCount`, `latestNoticeUpdatedAt`
  - 크롤러: `autoCrawler` 상태(최근 성공/실패 등)
  - DOM: 보드별 fingerprint 변경 여부(`changed`) 요약

---

## 14) 파일 변경 이력(운영 반영 기준)

- `/src/lib/adminActionGuard.ts`
- `/src/app/api/notices/crawl/route.ts`
- `/src/app/api/crawl/route.ts`
- `/src/app/api/debug/reset/route.ts`
- `/src/lib/noticeAutoCrawler.ts`
- `/src/app/api/alerts/email/digest/route.ts`
- `/src/lib/emailSender.ts`
- `/src/app/api/alerts/email/test/route.ts`
- `/src/app/api/user/profile/route.ts`
- `/src/app/page.tsx`
