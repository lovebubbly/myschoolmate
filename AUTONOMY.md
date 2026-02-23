# MySchoolMate 자율개선 워크플로우 (초안)

목표: "운영 안정성 자동 점검 → 이슈 감지 → 작은 패치 반복"을 먼저 굳히고,
그 다음 "신기능 아이디어 생성 → 우선순위화 → (가능한 범위) 자동 구현"로 확장한다.

---

## Phase 1) 안정화 루프 (Reliability-first)

### 매일(또는 배포 후) 자동 점검 체크리스트
1) **DOM 드리프트**: 셀렉터/구조 변화 감지
- 로컬: `npx tsx scripts/dom_fingerprint.ts`
- API:
  - `GET /api/admin/dom-fingerprint` (상태)
  - `POST /api/admin/dom-fingerprint/run` (즉시 캡처)

2) **크롤러 건강 상태**: 최근 성공/실패/재시도 확인
- `GET /api/notices` 응답의 `autoCrawler` 필드 확인

3) **알림 파이프라인**(선택): SMTP 설정된 환경에서 test/digest dry-run
- `POST /api/alerts/email/test`
- `POST /api/alerts/email/digest`

### 감지 → 조치 규칙(짧게)
- `changed: true` + `selectorHealth` 악화(예: rowCount=0)면: **크롤 셀렉터/파싱 로직 먼저 수정**
- 크롤러 `lastFailureReason` 반복/`retryCount` 급증이면: **DB/네트워크/대상 사이트 접근성 → 크롤 로직** 순서로 점검
- 조치는 항상 "작게"(1~2 파일) + `npm run lint && npm run build` 통과를 기본으로 한다.

---

## Phase 2) 신기능 아이디어 → 구현 루프 (Product loop)

### 아이디어 입력(재료)
- 유저가 자주 하는 행동/불편(대시보드, 공지 필터링, 마감일)
- 운영 지표(검색 실패, 추천 정확도, 알림 오탐/미탐)
- 반복되는 수동 운영 작업(= 자동화 후보)

### 우선순위 기준(가벼운 스코어링)
- Impact(유저 체감) / Effort(구현 난이도) / Risk(운영 리스크)
- 기본은 **작은 기능 1개를 1~2일 단위로 끝내는 방향**

### 구현 가드레일
- 가능하면 기능 플래그/옵션(환경변수)로 켜고 끌 수 있게.
- 최소 검증: lint/build + 핵심 API 1~2개 회귀 체크.
- 운영 영향을 주는 변경(스케줄/메시지/배포/대량 데이터)은 실행 직전에 승인 받기.

---

## 추천 운영 리듬(기본안)
- 매일: DOM 드리프트 + 크롤러 상태 1회 확인(요약 5줄)
- 주 1회: 가장 큰 불안정 1개 제거(신뢰성)
- 안정화 후: 주 1회 아이디어 5개 생성 → 상위 1개 MVP 구현
