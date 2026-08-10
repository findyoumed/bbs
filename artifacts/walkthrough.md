# 전자우편 문서 기준 수정 walkthrough

## 변경 내용

- `/guide/tosysop` 전용 footer 카테고리를 추가해 `#cmd-hint`의 `P`, `SEND`, `H`를 `data-cmd` 토큰으로 렌더링하고, 클릭 명령을 건의하기 raw handler로 연결했다.
- 건의하기 편집 화면의 받는 사람·제목·내용 행에 클릭 포커스와 리스너 정리를 추가하고, 누락된 `safeFocus()`를 구현했다.
- `buildMemoHelpAnsi`를 추가해 전자우편 7번 이용안내를 실제 ANSI 본문으로 렌더링했다.
- memo URL 생성은 `/memo`를 canonical로 사용하고, 기존 `/mail` 복원 경로는 유지했다.
- 도움말의 P/M/B·T·W·R·C·H, 메뉴 C, 상세 R/RE·Enter 입력을 실제 라우팅에 연결했다.
- 지연 편지는 메모리/Supabase의 받은 목록·unread count·직접 상세 조회에서 공통 수신 보류 정책을 적용했다.
- 제목 없는 레거시 쪽지 목록에서 본문 첫 줄을 제목으로 보여주던 fallback을 제거했다.

## 검증 결과

- `node --check` — memo ANSI builder, memo command router, command normalizer, memo repositories 통과
- `npm run smoke:vercel-ready` — 통과
- `npm run smoke:command-parity` — 통과
- `npm run smoke:menu-wiring` — 통과
- `npm run loop:verify` — 9/9 통과 (`qa:final` 포함)
- Memory repository 지연 편지 확인 — 보류 편지 목록 제외 및 unread 0 확인

시각 확인이 필요한 브라우저 환경에서는 `/memo`에서 7번을 클릭해 도움말 본문과 항목별 hover/click hotspot을 확인하면 된다.
