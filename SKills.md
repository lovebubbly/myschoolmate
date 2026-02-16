# SKills.md

목표: MySchoolMate( `src/app/page.tsx`, `src/app/globals.css`, `src/components/*`, `src/components/ui/*`)의 애니메이션/UX 설계를 **재사용 가능한 스킬 문서**로 정리한다.  
중심 가치는 `감각(모션)`과 `상태(로직)`를 분리하지 않고 서로 보완하게 만드는 것.

---

## 0-1) 왜 지금 구조가 살아 있는지: 싹싹 분석 노트

이 프로젝트의 UX는 “이쁘다”가 아니라 “상태가 보인다”를 기준으로 설계돼 있다.  
변경 작업 시 아래 4개 축을 먼저 점검하면 품질 저하를 크게 줄일 수 있다.

1. 상태 신호
- 레이아웃 모드, 필터, 태그, 다이얼로그, 위젯, 테마, 로딩의 각 상태가 동작 전환의 시작점인지.
2. 동작 신호
- 어떤 상태 변화가 `motion`을 트리거하는지.
- `layout`, `AnimatePresence`, `whileHover`, `whileTap`가 같은 축으로 겹치지 않는지.
3. 데이터 경로
- 필터/정렬 결과와 렌더 계층이 분리되어 있는지.
- 로컬 상태(`localStorage`)와 원격 동기화가 충돌하지 않는지.
4. 회귀 제어
- Playwright가 상태별 동작을 직접 검증할 수 있는지.

특이 리스크:
- `src/components/NoticeCard.tsx`는 현재 메인 경로(`/src/app/page.tsx`)와 다른 NoticeCard 구현이 존재해 중복 출처 리스크가 있다.
- 반복 애니메이션(마스코트/로딩/글로우)은 reduced-motion 환경에서 감쇄 정책이 별도 레이어로 없으면 사용자 피로가 커진다.
- 다이얼로그/오버레이는 내부 스크롤 제약(`notice-dialog-scroll`)이 깨지면 모바일 회귀가 가장 먼저 터진다.

## 0) 한 줄 설계 철학

이 코드베이스는 “깔끔한 배경 + 미세 모션 + 명확한 상태 피드백”을 통해 학습/정보 과부하를 줄인다.  
모든 모션은 다음 질문에 답해야 한다.

1. 지금 화면이 무슨 상태인지 알려주는가?
2. 사용자가 무엇을 제어할 수 있다는 느낌을 주는가?
3. 상호작용 경로가 끊기지 않는가?

동작이 과하다면 제거한다. 상태가 불분명하면 애니메이션을 넣는다.

---

## 1) 설계 정체성 (이 프로젝트에서 고정된 미학)

### 1-1. 시각 정체성
- `src/app/globals.css`의 토큰 기반 색/반경 체계를 쓰며 컴포넌트 자체 스타일은 최소화한다.
- 배경은 `bg-background` 위주의 중성 톤, 카드/강조는 `bg-card`, `border`, `shadow-sm` 계열.
- 큰 반경(`--radius: 1rem`, 카드 24~32px)으로 `soft UI + glassmorphism` 느낌.
- 폰트는 Pretendard를 글로벌로 강제.
- 다크/라이트를 각각 다른 배경/텍스트 토큰으로 완전 분리한다.
- `backdrop-blur` + 반투명 카드 배경을 병행해 깊이감을 만든다.

### 1-2. 모션 정체성
- 프레임별 즉시 반응하는 마이크로 인터랙션(`hover`, `focus`, `tap`)과 영역 재배치 애니메이션(`layout`)을 혼합.
- 페이지 단위 애니메이션은 과하지 않게 0.2~0.6초로 짧고 선명하게.
- 스프링 파라미터는 `stiffness 300~360`, `damping 24~30`이 일관되게 사용됨.
- 느린 회전/펄스/글로우는 브랜딩 요소가 강한 컴포넌트(마스코트/탭/상태표시)에서만 제한적으로 사용.

### 1-3. 동선 정체성
- 상단 고정 네비게이션은 스크롤 연동으로 존재감 유지.
- 사용자 목적은 필수 동작(읽기/검색/정렬/필터/새로고침/상세열기) 단계를 따라 단계적으로 공개.
- “읽는 정보량”이 많을수록 “모션의 목적”을 먼저 정의한 뒤 동작을 추가.

---

## 2) 필수 기술 스택 (재사용 전제)

```txt
Next.js 16 / React 19 / TypeScript
tailwindcss 4 / tw-animate-css
framer-motion
next-themes + next-auth
Radix UI (dialog/select/checkbox/tabs/progress)
lottie-react
lucide-react
react-markdown + remark
```

`package.json` 기준 의존성 버전은 동급 버전 사용이 가장 안정적이다.

---

## 3) 공통 레이어 설계 (실제 파일 기반)

### 3-1. 전역 토큰 & 접근성 기반
`src/app/globals.css`
- `:root`와 `.dark`로 토큰 분기.
- `--theme-transition-duration: 260ms`, `--theme-transition-easing: cubic-bezier(0.18, 0.89, 0.33, 1)`로 테마 전환 표준화.
- `.theme-transition` 클래스가 붙으면 배경/텍스트/보더/채움/스트로크 색상 전이가 동기화됨.
- `prefers-reduced-motion`에서 거의 즉시 전환으로 감쇠 처리.
- 핵심 의미: **테마 전환을 시스템이 아니라 UX의 일부로 제어**.

### 3-2. 라우트/레이아웃 골격
`src/app/layout.tsx`, `src/components/ThemeProvider.tsx`
- 루트에서 `ThemeProvider`를 감싸고, 브라우저 전역 스타일만 바꾸지 않고 컴포넌트 단위 렌더링에 영향.
- `AuthSessionProvider`와 UI 렌더 트리를 분리해 상태 계층이 얽히지 않게 함.

### 3-3. 네비게이션 동작 표준
`src/components/NavBar.tsx`
- 스크롤 양에 따라 패딩/로고 스케일을 바꿔 “밀도와 시각중심”을 조정.
- 메뉴 버튼과 아이콘은 `whileHover`/`whileTap`로 즉시 반응.
- 인증 여부를 UI로 분기(로그인/익명/로그인된 이름).
- 모바일/데스크톱 분기와 `aria-current`, `aria-label`로 접근성 유지.

### 3-4. 테마 토글 패턴
`src/components/ModeToggle.tsx`
- 토글 클릭 시 `document.documentElement.classList.add("theme-transition")`로 전역 애니메이션 시작 표시.
- `requestAnimationFrame` 2회 후 `setTheme()`로 브라우저 렌더 타이밍 안정성 확보.
- 260ms 타이머로 마커 클래스 제거.
- 아이콘도 `AnimatePresence + motion`으로 변환(태양↔달).

### 3-5. 공지카드 패턴
`src/app/page.tsx`의 `NoticeCard`와 `NoticeDialog`
- `motion.div`로 진입/이탈/호버/터치 모두 규격화.
- `layout + initial/animate/exit + spring`으로 렌더 순서 변화 시 위치 이동이 자연스럽고 튀지 않음.
- 카드 내부는 고정 높이 하우스닝 + 태그/요약/마감일 배지를 계층적으로 정렬.
- 다중 텍스트/태그/링크가 있어도 `line-clamp`로 리듬 유지.
- 상세 보기는 `Dialog`로 오버레이 고정, 스크롤은 내부 `.notice-dialog-scroll`만 허용.

### 3-6. 드래그형 위젯 패턴
`src/app/page.tsx`의 Reorder 영역
- `Reorder.Group axis="y"` + `Reorder.Item`으로 위젯 순서 편집.
- 저장은 localStorage/서버 동기화를 디바운스(500ms)로 분리.
- 로컬에서 편집 가능한 UI만 드래그 힌트 노출(hover 시 handle 표시).
- 각 위젯은 자체 `motion.section` 진입 애니메이션.

### 3-7. 위젯별 모션 모듈
- `src/components/CafeteriaWidget.tsx`  
  - 섹션 단위 진입(`initial y:40` → `y:0`) + hover lift.
  - 탭 전환은 `layoutId`로 active pill 이동.
  - 메뉴 내용은 `AnimatePresence`로 교차 페이드/스케일.
- `src/components/Mascot.tsx`
  - `show/hide`, hover, 새 메시지 상태를 모두 모션으로 처리.
  - 자동 최소화/랜덤 이모지로 인간적 상호작용 강화.
- `src/components/LoadingOverlay.tsx` + `src/components/LottieAnimations.tsx`
  - 회전 링 + 스케일 펄스 + 텍스트 슬라이드로 “작업 대기” 피드백 강화.
- `src/components/TiltCard.tsx`
  - 3D 마우스 포즈와 빛 번짐으로 시각적 입체감을 주되 계산은 useMotionValue로 제한된 범위.

### 3-8. UI 기본 컴포넌트 철학
`src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`  
- 모션 중심 화면일수록 기본 컴포넌트는 부드러운 상태 전이(`transition-all`, `active:scale`)만 가짐.
- Radix 기반 `data-[state]` 애니메이션은 모달/셀렉트에서 일관성 유지.
- 접근성 포커스(`focus-visible`)와 라운드/높이/크기 토큰 통일.

---

## 4) 상태-움직임 매핑 (이 프로젝트의 핵심 규칙)

### 4-1. 상태별 UI 반응
- 로딩: `LoadingOverlay` 또는 `ButtonLoader`로 즉시 피드백.
- 검색/필터 갱신: 결과 변경 시 `AnimatePresence mode="popLayout"`으로 DOM 변경 흔들림 완화.
- 카테고리 전환: active pill은 `layoutId="activeTab"`으로 이동 모션.
- 핀 공지 확장: `height/opacity` 트랜지션으로 정확한 영역 제어.
- 레이아웃 변경(카드↔리스트): `data-testid` 기반 레이아웃 스왑 + `opacity` 회복 assert.

### 4-2. 데이터와 애니메이션 분리
- API에서 값이 바뀌면 즉시 state set, render 시점에서 모션으로 입혀서 “기능 우선” 유지.
- `useMemo`로 파생데이터 계산 후 UI에서만 모션 컴포넌트 렌더.
- 긴급 업데이트(크롤러/새로고침)는 먼저 상태 반영 후 `Loaders`로 연쇄 피드백.

### 4-3. 저장/복원 패턴
- 대시보드 상태(localStorage):
  - `dashboard-widget-order`, `dashboard-enabled-widgets`, `dashboard-read-notice-ids-v1`, `dashboard-selected-tags-v1`
- 사용자 프로필/위젯 구성을 API(`POST /api/user/profile`)에 동기화.
- 동기화는 즉시 연타를 막기 위해 타이머 디바운스.
- 로컬 기준이 API 기준을 덮어쓰기보다 하위 호환적으로 합쳐짐.

---

## 5) 성능과 체감 완성도 기준

- 과도한 리렌더를 막기 위해 가능한 한 `useMemo` + `useCallback`으로 비용 큰 계산/필터링 최소화.
- 모션이 많은 목록(공지 카드)에서는 `index` 기반 delay로 과도한 동시 start를 완화.
- 위젯은 `Reorder` 블록 하나로 집약해 전체 페이지를 다시 렌더하지 않음.
- `transition`과 `backdrop-blur` 사용은 GPU 부담이 큼을 감안해 단일 컴포넌트 중심 적용.
- `prefers-reduced-motion` 처리로 접근성/저성능 장치 대비.

---

## 6) 테스트 규약으로 고정한 UX 불변식

해당 프로젝트는 Playwright 회귀 테스트로 모션 UX를 보장한다.

- `tests/regression.ux.spec.ts`
  - 테마 토글이 `theme-transition` 마커를 잠깐 붙였다가 제거하는지.
  - 핀 공지 CTA가 표시되고 스타일이 적용되는지.
  - 다이얼로그가 내부 스크롤 영역을 가지며 부모 스크롤이 overflow hidden인지.
- `tests/regression.mobile-ux.spec.ts`
  - 모바일에서 주요 컨트롤 가시성, 리스트/카드 전환, 다이얼로그 스크롤 제약.
- `tests/regression.notice-animation.spec.ts`
  - 카드↔리스트 레이아웃 전환 후 opacity 회복.

이 규약은 “디자인 완성도”가 아니라 “동작 완성도”로 간주되어 변경 시 항상 통과 여부를 확인해야 한다.

---

## 7) 타 프로젝트 적용 Playbook (순서형)

1. 기본 토큰 먼저 구축한다. `@/app/globals.css`에 색/반경/폰트/테마전환 marker를 둔다.
2. `ThemeProvider` + `ModeToggle`을 연결하고, 토글 동작이 글로벌 트랜지션 클래스를 사용하게 한다.
3. 공통 UI(`Button`, `Card`, `Input`, `Dialog`)를 Radix 또는 유사 라이브러리로 통일한다.
4. 페이지 단위 데이터 파이프라인을 분리한다. 데이터 fetch가 상태를 바꾸고, 모션은 상태를 렌더링한다.
5. 공지/목록형 콘텐츠가 있다면 `motion.div` + `AnimatePresence` + `layout` 패턴을 적용한다.
6. 탭/필터/검색/정렬은 모두 “상태변경 = 위치변경”을 고려해 popLayout으로 레이아웃 급변 동작을 제어한다.
7. 설정이 많거나 사용자가 조작하는 블록이 많으면 Reorder 위젯으로 구성 가능성을 열어둔다.
8. 마스코트/로딩/브랜딩 컴포넌트는 기능이 있을 때만 사용한다.
9. 모든 모달은 내부 스크롤 영역을 제한하고, 바깥 오버플로우를 고정한다.
10. reduced-motion, aria-label/role, keyboard focus를 우선 배치한다.
11. 마지막으로 기존 회귀 테스트 또는 최소 동일 시나리오(테마 전환, 레이아웃 전환, 모달 스크롤, 버튼 접근성)를 스모크한다.

---

## 8) 재사용 템플릿 (코드 스니펫)

### 8-1. 카드 진입/호버/이탈

```tsx
<motion.div
  layout
  initial={{ opacity: 0, y: 28, scale: 0.96 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -10, scale: 0.96 }}
  transition={{
    delay: index * 0.05,
    type: 'spring',
    stiffness: 320,
    damping: 26,
    layout: { type: 'spring', stiffness: 360, damping: 30 },
  }}
  whileHover={{ y: -8, scale: 1.025, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
  whileTap={{ scale: 0.985 }}
>
  ...
</motion.div>
```

### 8-2. 테마 토글 전환

```tsx
root.classList.add("theme-transition");
setIsTransitioning(true);
requestAnimationFrame(() => requestAnimationFrame(() => setTheme(nextTheme)));
setTimeout(() => {
  root.classList.remove("theme-transition");
  setIsTransitioning(false);
}, 260);
```

### 8-3. 팝업 레이아웃 교체

```tsx
<AnimatePresence mode="popLayout">
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    ...
  </motion.div>
</AnimatePresence>
```

### 8-4. Reorder 위젯 블록

```tsx
<Reorder.Group axis="y" values={widgetOrder} onReorder={saveWidgetOrder}>
  {widgetOrder.map((id) => (
    <Reorder.Item key={id} value={id}>
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        ...
      </motion.section>
    </Reorder.Item>
  ))}
</Reorder.Group>
```

---

## 9) 주의사항

- `src/components/DashboardClient.tsx`는 현재 라우트에서 참조되지 않는다. 과거 구현과 중복이므로 신규 프로젝트에서는 사용 출처를 명확히 정리한다.
- 동일 기능에 대한 다중 NoticeCard 구현(구형/신형)은 유지보수 위험이다. 새 프로젝트에서는 단일 소스만 사용한다.
- 시각적 과장(과도한 3D, 장시간 회전, 대형 스케일 오버슈트)은 사용성을 떨어뜨릴 수 있어 `reduce-motion` 기준으로 필터링한다.
- 다이얼로그 내부 스크롤은 `.notice-dialog-scroll` 같은 고정 규칙으로 제어해야 모바일에서 오버스크롤 이슈를 막을 수 있다.

---

## 10) 프로젝트 적용 포인트 요약

이 UX는 “모션이 예쁘기 때문에 쓰는 것”이 아니라 “수많은 상태를 정돈하고 사용자의 정신적 피로를 줄이는 시스템”이다.  
핵심은 다음 한 문장으로 귀결된다.

**토큰으로 형태를 고정하고, 상태로 리듬을 만들고, 모션으로 신뢰를 전달한다.**
