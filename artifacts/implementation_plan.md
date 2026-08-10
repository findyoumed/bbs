# 구현 계획

1. `memoAnsiBuilders.js`에 문서(`docs/NOWNURI_MENUS/전자우편_1.txt`)의 7번 도움말 화면을 추가하고 public API로 노출한다.
2. `routingUrlBuilder.js`의 memo 메뉴·목록·상세·작성·도움말 URL을 `/memo` 기준으로 변경한다. 기존 `/mail` 복원 경로는 별칭으로 보존한다.
3. `commandRouterMemo.js`, `commandNormalizer.js`, memo 서버 저장소를 문서와 대조해 한 논리 단위씩 수정한다.
4. 각 단위마다 문법 검사와 관련 smoke를 실행하고, 실패 시 원인을 수정한 뒤 다음 단위로 진행한다.
5. 최종 변경·검증 결과를 `WORK_LOG.md`, `walkthrough.md`에 기록한다.
