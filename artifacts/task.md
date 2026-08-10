# 전자우편 문서 기준 정합성 수정 체크리스트

**작업일:** 2026-08-10
**반복 상한:** 최대 5회

- [x] 전자우편 이용안내 ANSI 빌더를 구현하고 7번 메뉴에 연결
- [x] 전자우편 canonical URL을 `/memo`로 통일하고 `/mail` 별칭은 유지
- [x] 메뉴·도움말 명령 및 답장/Enter 동작 정합성 점검
- [x] 지연 편지 노출 정책과 목록 제목 미리보기 점검
- [x] 문법·스모크 검증, WORK_LOG 및 walkthrough 갱신

## 종료 기준

- 수정 대상 JavaScript 파일 `node --check` 통과
- `npm run smoke:vercel-ready` 통과
- 실행한 검증의 성공·실패를 `walkthrough.md`와 `WORK_LOG.md`에 사실대로 기록
