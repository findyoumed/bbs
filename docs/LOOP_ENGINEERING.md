# Loop Engineering 런북 (BBS 프로젝트)

이 문서는 이 저장소에서 **루프 엔지니어링**으로 개발을 진행하는 방법을 정리한다.

## 1. 개념

- **하네스(Harness)**: AI가 안전하게 반복 작업하도록 감싸는 규칙·자동화(문법검사, 금지명령 차단, 기록 강제, 검증 스크립트).
- **루프(Loop)**: 하네스 위에서 AI가 목표를 **증거(테스트·QA) 기반으로** 완료 판정할 때까지 감독된 반복을 도는 것.
- 핵심은 "AI의 느낌상 끝난 것 같다"가 아니라 **정확한 테스트 통과를 완료 근거로 삼는 것**이다.

## 2. 이미 갖춘 하네스 (변경 불필요)

| 요소 | 위치 | 역할 |
|---|---|---|
| 하네스 훅 | `.claude/settings.json` | ① `git push` 차단(PreToolUse) ② 매 Write/Edit마다 `node --check` JS 문법검사(PostToolUse) ③ Stop 시 WORK_LOG 기록 알림 |
| 루프 엔진 | `/ralph-loop`, `/loop` 스킬 + `.claude/ralph-loop.local.md` | 감독 반복 실행/상태 추적 |
| 코딩 에이전트 | `.claude/agents/bbs-coder.md` | 코드 변경 전용 서브에이전트 |
| 검증 | `scripts/smoke-*.js`, `scripts/final-qa-report.js` | 도메인별 스모크 + 최종 QA |
| 완료 게이트 | `scripts/loop-verify.js` (`npm run loop:verify`) | **전 검증을 한 번에 돌려 단일 pass/fail** |
| 상태 기록 | `WORK_LOG.md` | 매 작업의 목표·변경·검증·결과 누적 로그 |

## 3. 완료 기준 (Definition of Done)

작업은 **아래 셋이 모두 충족될 때만** "완료"다:

1. **`npm run loop:verify` 초록** — 증거 기반 자동 완료 판정.
   빠른 게이트(결정적 스모크 8종 + `qa:final`)를 순차 실행해 전부 통과해야 exit 0.
   포함: boards, command-parity, menu-wiring, signup-ime, renderer-ui, chat-rooms, auth-bridge, vercel-ready, qa:final.
   제외(비결정적·느림, 게이트 부적합 → 수동 실행): `smoke:rss-services`(라이브 뉴스 콘텐츠 의존 — 20260719_1400 루프 실행 중 발견해 게이트에서 제외), `smoke:full-traversal`, `smoke:supabase-live`/`realtime`/`auth-write`.
2. **변경 기능의 실측 확인** — 화면/흐름이 있으면 브라우저(Playwright)나 실제 API로 직접 구동해 눈으로 확인. (테스트 통과만으로 끝내지 않는다.)
3. **`WORK_LOG.md` 기록** — `LOG_ID`(YYYYMMDD_HHMM)와 함께 목표·원인·수정·검증·결과.

## 4. 루프 실행법

1. **먼저 플랜 모드**로 계획을 세우고 검토받는다 (무작정 루프 금지).
2. 루프 시작:
   - 감독형: `/ralph-loop --completion-promise "npm run loop:verify 초록 + <기능> 실측 확인 + WORK_LOG 기록"`
   - 자기 페이싱: `/loop` (간격 없이 모델이 스스로 반복)
3. **완료 조건에 `npm run loop:verify` 통과를 반드시 명시**한다 — 이게 루프의 종료 근거.
4. **감독 반복 상한 5~10회**. `.claude/ralph-loop.local.md`의 `max_iterations`가 상한(현재 `10`). 상한에 닿으면 루프를 멈추고 사람이 검토한다 — 무한 루프·토큰 낭비 방지.

## 5. 안전·자율성 규칙

- **`git push` 금지** — 하네스 훅이 차단. 배포/푸시는 사람이 직접.
- **커밋은 요청 시에만** — 루프가 자동 커밋하지 않는다.
- **매 편집 문법검사 자동** — 훅이 `node --check`로 즉시 잡는다.
- **과잉 구축 금지** — 이 프로젝트의 반복 교훈: "원전(하이텔/나우누리)에 있다"는 이유만으로 빈 껍데기(글 0건 게시판, 갈 곳 없는 메뉴, 중복 화면)를 만들지 않는다. 실제 데이터·동작·쓸모가 있을 때만 추가한다.
- **정직한 보고** — 스킵/미검증/실패는 그대로 기록한다(예: 브라우저 권한이 막혀 실측 못 한 경우 명시).

## 6. 에이전트 활용 (교차 검증)

영상의 "역할 분리 교차검증"은 기존 도구로 수행한다:

- **코딩**: `bbs-coder` 서브에이전트(Agent 도구) — 국소적·병렬화 가능한 코드 변경.
- **리뷰/버그헌트**: `/code-review` 스킬 — 변경 diff를 별도 관점으로 교차 검증(correctness·simplification). 큰 변경은 `/code-review high` 또는 `ultra`.
- 코딩 에이전트가 만든 것을 리뷰 스킬로 검증 → 루프가 자기 산출물을 스스로 점검하는 구조.

## 7. 한 줄 요약

> 플랜 → 루프(bbs-coder + code-review) → **`npm run loop:verify` 초록 + 실측 + WORK_LOG** 셋이 될 때까지 감독 반복(≤10회). 완료는 느낌이 아니라 게이트가 판정한다.
