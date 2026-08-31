# 전체 오류 감사 구현 계획

1. 현재 상태와 `WORK_LOG.md`를 읽고 변경 범위를 고정한다.
2. `node --check` 전수 검사, `npm run loop:verify`, `npm test`를 분리 실행한다.
3. 서버가 실행 중이면 주요 페이지와 API를 읽기 전용으로 점검하고 콘솔·HTTP 오류를 수집한다.
4. 재현 가능한 코드 오류만 최소 범위로 수정하고 각 수정에 LOG_ID를 남긴다.
5. 전체 회귀 검증을 반복하고 남은 환경 문제는 코드 오류와 구분해 기록한다.
## PC communication mail semantics iteration (2026-08-28)

1. Compare historical mail commands with current global and GO routers.
2. Make ME/MEMO inbox shortcuts, MAIL top-level menu, RMAIL inbox, and CMAIL sent-box semantics explicit.
3. Add executable regression assertions for navigation calls and `_memoBox` state.
4. Run syntax, command parity, full loop gate, traversal, and Supabase readiness checks.

Exit criteria: all command and traversal checks pass; no unsupported historical route is fabricated.
## Cross-service GO compatibility iteration (2026-08-28)

1. Compare the three-service command guide with the live `/api/menu` tree.
2. Add only a documented alias whose equivalent board exists in the current service.
3. Pass canonical alias targets into menu/board resolution and cover the route in GO smoke tests.
4. Execute syntax, command parity, loop gate, full traversal, and Supabase readiness checks.

Decision: `WORD -> PLAZA` is accepted because the current `PLAZA` board exists; `BLUEHOUSE`, `ELF`, and other unsupported targets remain intentionally unmapped.

## Small-notice restoration (2026-08-28)

1. Confirm that the ANSI builder still supports `[작은공지] ... (GO NOTICE)` and that the main-menu caller was passing `null`.
2. Read one latest item from the existing public notice endpoint with a short client cache; failures remain non-blocking.
3. Pass the title into the existing builder so its current ANSI width fitting and hotspot scanner remain the single rendering path.
4. Add a static interaction-contract regression and run syntax, GO/ANSI smoke, full traversal, loop verification, and Supabase readiness checks.

Exit criteria: the main menu can show a current notice and the existing GO NOTICE token remains clickable and keyboard reachable without changing the 80-column renderer.

## Root hotspot regression coverage (2026-08-28)

1. Load the live root screen in Chromium and count the generated native hotspot buttons.
2. Reload the root for each button, click it, and require a route or screen-state transition.
3. Special-case `(GO NOTICE)` to require `/notice`, then retain the existing console/page-error collection.

Exit criteria: all generated root hotspots are proven clickable in the browser, not only by static source assertions.

## Direct guide route coverage (2026-08-28)

1. Add `/guide/tosysop` to the real Playwright route list.
2. Verify the guest-protected route resolves to a usable terminal screen rather than an empty shell or browser error.
3. Keep authenticated contact editing behavior covered by the existing memo/contact harness; do not weaken the login guard.

Exit criteria: the bookmarked guide path is included in every traversal and remains safe for guest sessions.

## Authenticated suggestion editor regression (2026-08-28)

1. Open GUIDE in an isolated browser page and set only the smoke-test user state to a non-guest fixture.
2. Click the existing `건의하기` hotspot and require the subject/body editor plus the original send/cancel hint.
3. Submit an empty editor with Ctrl+S and require an inline validation row, subject focus, and unchanged hint text.

Exit criteria: the real editor preserves PC통신-style inline validation without allowing errors to overwrite the bottom hint bar.

## Nested-menu click audit (2026-08-28)

1. Enumerate rendered hotspots on GUIDE, BBS, AGORA, GAME, and LOG screens.
2. Reload each screen and click every rendered child-menu hotspot independently.
3. Require a URL or screen transition; treat the guest-only TOSYSOP return to GUIDE and external OAuth handoffs as intentional outcomes.

Exit criteria: every currently rendered child-menu action is reachable by mouse without introducing a new menu or empty feature.

## AGORA route semantics (2026-08-28)

1. Compare `legacy/hanulso.mnu` where `AGORA` is a menu container and `VOTE` is its child with the current route restorer.
2. Restore `/agora` to the existing board-select container and use `/agora/vote` for the vote-list screen.
3. Preserve `/agora/create` and numeric vote-detail routes so existing links remain valid.
4. Add browser assertions for direct reload semantics and update mobile smoke coverage to the child route.

Exit criteria: direct `/agora` and `/agora/vote` reload into their matching screen states, while the full traversal remains console-error free.

## AGORA command contract (2026-08-28)

1. Extend the existing GO smoke harness with `GO AGORA` and `GO VOTE` using the same menu-node action path as production.
2. Assert that the route restorer keeps the parent container and child vote-list branches distinct.
3. Keep the assertions narrow so no unsupported historical target or second navigation mechanism is introduced.
4. Run the GO/ANSI smoke and the full loop completion gate.

Exit criteria: AGORA command and direct URL semantics remain aligned and all ten completion checks pass.

## Historical plan status synchronization (2026-08-28)

1. Re-read `docs/hitel_upgrade_plan.txt` and compare each Phase 1~3 item with the current router, screen, and smoke evidence.
2. Add a dated status section to the source plan while preserving its historical planning text.
3. Record CAP as intentionally excluded by the existing user decision rather than treating it as a missing implementation.
4. Keep this documentation-only correction separate from production behavior and log it with a `LOG_ID`.

Exit criteria: the learned plan distinguishes implemented, intentionally excluded, and still-open work without changing runtime behavior.

## SOS emergency command (2026-08-28)

1. Confirm the historical command guide documents `SOS [메시지]` and identify the existing sysop contact API/editor as the only current equivalent.
2. Add a global `SOS` command metadata entry and route it to the contact editor rather than inventing a second send path.
3. Prefill an explicit emergency subject and the supplied message; require the existing Ctrl+S confirmation and preserve guest protection.
4. Verify command parity, real browser input, full traversal, completion gate, Supabase readiness, unit tests, and diff integrity.

Exit criteria: authenticated SOS input opens a reviewable sysop draft, guests cannot send it, and no existing contact/memo flow regresses.

## Historical long-form command parity (2026-08-28)

1. Compare the three-service command guide with the actual command normalizer and local screen routers.
2. Fold only unambiguous long forms (`PREV`, `MAIN`, `QUIT`, `NEXT`, `BACK`, `WRITE`, `ANSWER`, and screen-safe `READ`) into existing canonical commands.
3. Implement list-screen `R/READ 번호` and `RE/ANSWER 번호` using the existing visible-post resolver and authenticated post-write guard.
4. Implement memo-list/menu `R/READ 번호` and `S/SEND 아이디` using existing memo view/compose screens.
5. Add command-parity assertions before running the full browser and Supabase gates.

Exit criteria: documented long forms reach the same existing flows as their short forms, guest/auth guards remain unchanged, and all verification gates pass.

## Member and PDS long-form aliases (2026-08-28)

1. Reuse the existing PF profile and HI account-information handlers for `FINGER [아이디]` and `INFO`.
2. Reuse the existing PDS list handler for `FL` without adding a second data path.
3. Extend command-parity coverage and run the full browser, loop, Supabase, and unit gates.

Exit criteria: the documented aliases are canonicalized only in safe contexts and all existing routes remain green.

## Historical GO compatibility catalog (2026-08-28)

1. Compare the common/provider-specific GO list with `legacy/hanulso.mnu` and the current route handlers.
2. Add only the verified `BLUEHOUSE -> TOSYSOP` equivalent; keep existing canonical MAIL/CHAT/HUMOR behavior unchanged.
3. Document provider-specific keywords with no current equivalent as intentionally unresolved.
4. Add regression assertions so unresolved keywords cannot silently navigate to an unrelated board.

Exit criteria: `GO BLUEHOUSE` reaches the existing suggestion editor, unsupported historical destinations remain explicit failures, and all verification gates pass.

## Historical common GO and status audit follow-up (2026-08-28)

1. Add regression coverage for the common `GO CHAT` and `GO HUMOR` destinations using their existing menu-node actions.
2. Reconcile the source plan's stale P4-4/P4-5 descriptions with the already implemented DN protocol and ABSENT flows.
3. Re-run the focused and release verification gates without changing the selected UI or data model.

Exit criteria: common GO commands are covered by the same resolver contract, and the plan no longer labels implemented flows as pending.

## GO from active chat rooms (2026-08-29)

1. Confirm that chat input is dispatched before global commands and therefore can swallow plain `GO` text.
2. Route `GO code` and `/GO code` through the existing global resolver before the chat-message fallback.
3. Leave the room only after a successful navigation; preserve the room for unresolved targets and show a local hint.
4. Add a module harness and run full Chromium traversal.

Exit criteria: the historical “GO anywhere” behavior works inside active chat rooms without sending commands as messages or dropping the user on failed targets.

## Inline game validation (2026-08-28)

1. Audit amusement-screen validation branches for direct `setHint()` calls that can overwrite the bottom command hint.
2. Reuse the existing inline prompt hosts and add one scoped validation-row helper for bio, fortune, MBTI, compatibility, and Tojeong screens.
3. Preserve successful result rendering and clear stale validation rows when the user advances to the next screen.
4. Add Playwright coverage that submits invalid values and compares the pre-submit hint with the post-submit hint.
5. Run syntax, full traversal, loop, Supabase, unit, and diff verification.

Exit criteria: all covered game errors are rendered in the screen body, the command hint remains unchanged, and no existing game route or successful input flow regresses.

## Mail-list forward command (2026-08-28)

1. Compare the historical `FW 번호 아이디` form with the current memo-list and memo-view routers.
2. Reuse the existing forwarded-content prefill and `showMemoWrite` path instead of adding a second send API.
3. Reject an unknown list number without opening a compose screen.
4. Add command-parity assertions for the selected memo and forwarding recipient.
5. Run syntax, full traversal, loop, Supabase, unit, and diff verification.

Exit criteria: forwarding from a memo list preserves the selected message body and opens the existing compose screen for the requested recipient.
## Korean and cross-provider board aliases (2026-08-28)

1. Read the documented Nownuri Korean keyword and Chollian board keyword.
2. Verify equivalent `HUMOR` and `PLAZA` boards exist in the live menu tree.
3. Add aliases and pass canonical values into existing navigation resolution.
4. Add GO regression checks and run all release gates.
## Historical chat-room list shortcut (2026-08-29)

1. Compare the documented `/l` and `/list` forms with the active-room command router.
2. Reuse the existing `/p` leave-and-lobby path so room cleanup remains centralized.
3. Add a module assertion for the leave request and exactly-once lobby render.
4. Run the focused command smoke and then the full verification gates.

Exit criteria: `/l` and `/list` are handled only inside an active room and never become ordinary chat messages.
## Historical WHO/U member lookup (2026-08-29)

1. Compare the common `WHO`/`U` command with the existing active-user handler.
2. Gate the alias around post-list and post-view screens where `U` already has local meaning.
3. Add a command-parity assertion for the main-screen shortcut.
4. Run the focused command smoke and all release verification gates.

Exit criteria: `U` opens the active-user list outside screen-local write/attachment contexts.
## Historical post-list A reply shortcut (2026-08-29)

1. Compare the documented `RE`, `A`, and `ANSWER` reply forms with the list router.
2. Add only the list-local `A 번호` spelling to the existing reply resolver.
3. Preserve post-view `A` as previous-article navigation.
4. Add command-parity coverage and run all release gates.

Exit criteria: `A 번호` opens the existing authenticated reply composer for the selected post.
## Command-help parity (2026-08-29)

1. Compare `CMD_META` tips and descriptions with the historical command guide and current routers.
2. Clarify context-sensitive `A`, `WHO/U`, and memo-list `FW` forms.
3. Add focused assertions for the documented spellings.
4. Run the focused command smoke and all release gates.

Exit criteria: help metadata no longer hides or misdescribes implemented PC communication aliases.
## Chat-room footer discoverability (2026-08-29)

1. Compare active-room `/L`/`/LIST` and `/W`/`/WHO` handlers with the current footer category.
2. Add only no-argument commands that have working click and keyboard dispatch paths.
3. Keep the existing room creation and status tokens unchanged.
4. Run the full browser, loop, Supabase, unit, and diff gates.

Exit criteria: the chat-room footer exposes functional list and participant shortcuts without dead click targets.

## Recent-post filter discoverability (2026-08-29)

1. Compare the historical `NEW/NW` list command with the existing post-list router.
2. Add only the no-argument `NEW` token to ordinary and unified PDS list footers.
3. Keep the existing three-day filter request and all search/paging commands unchanged.
4. Add command-parity assertions for both footer categories and run the focused smoke.

Exit criteria: `NEW` is a working clickable list shortcut wherever the current router already supports it, with no new route or query semantics.

## Nownuri CHATIN compatibility (2026-08-29)

1. Compare the Nownuri `CHATIN` entry point with the current `/chat` lobby and `CHAT` command.
2. Normalize `CHATIN` to `CHAT` so existing command metadata and routing remain canonical.
3. Inject the existing lobby renderer into global navigation and keep active-room text handling first.
4. Add normalization, metadata, and renderer-reuse assertions before the full verification gates.

Exit criteria: authenticated `CHAT` and `CHATIN` open the same existing lobby, while guest and active-room behavior remain guarded by current rules.

## Numeric F list positioning (2026-08-29)

1. Compare the documented common `F [번호]` form with the current post-list router.
2. Reuse `LS [번호]` for numeric `F` on post lists only.
3. Preserve bare `F` pagination and all post-view/service `F` meanings.
4. Add normalization assertions and run the full verification gates.

Exit criteria: `F 번호` reaches the existing number-position flow without introducing a second lookup implementation.

## Nownuri GO CHATIN alias (2026-08-29)

1. Confirm `CHATIN` is the historical Nownuri chat-entry menu code.
2. Add a single canonical alias to the existing `CHAT` target.
3. Extend GO regression coverage without changing chat-room or lobby handlers.
4. Run syntax, GO/ANSI, loop, Supabase, unit, and browser traversal checks.

Exit criteria: `GO CHATIN` and `GO CHAT` invoke the same existing chat-lobby route.

## Common-flow stability: authenticated chat occupancy (2026-08-28)

1. Run the existing common-flow smoke scripts before changing behavior.
2. Reproduce and isolate the chat room capacity failure in the memory driver.
3. Keep the Auth UUID on memory participants, matching the Supabase participant contract.
4. Align the smoke fixture with the real request context and rerun focused plus release checks.

Exit criteria: one authenticated member using multiple sessions consumes one room slot in every driver, while guest sessions retain one slot each.

## Supabase chat-member smoke contract (2026-08-29)

1. Run the Supabase member persistence smoke against the configured project.
2. Trace the capacity failure to the profile fixture and compare it with `AuthBridge` output.
3. Supply the Auth UUID explicitly in the fixture; leave repository and production routing unchanged.
4. Re-run the focused smoke and the release verification gates.

Exit criteria: the test exercises authenticated persistence, hybrid occupancy, and cleanup using the same context shape as the live application.

## Browser memo-editor regression (2026-08-29)

1. Open the existing memo menu in a separate browser page and set the QA session fixture.
2. Enter the editor through the existing `W` command.
3. Assert Enter and row-click focus transitions plus inline empty-body validation.
4. Run full traversal and all release gates; leave memo persistence and routing untouched.

Exit criteria: the most common memo compose interaction is verified in Chromium, not only through HTTP/module harnesses.

## Browser memo-list selection coverage (2026-08-29)

1. Intercept one deterministic memo-list response in the isolated browser page.
2. Enter the existing `RMAIL` list and click the generated memo hotspot.
3. Assert that the existing memo-view route opens, then run the editor focus checks.
4. Keep the fixture in-memory and rerun full traversal plus the 24-check loop gate.

Exit criteria: memo list click-to-read and memo compose keyboard flows are both covered without database writes or runtime feature changes.

## Hint-bar Tab action and Supabase schema reproducibility (2026-08-29)

1. Map the visible `Tab` hint to a dedicated focus action instead of the nonexistent `TAB` command.
2. Preserve the previously focused editor field when a clickable token receives browser focus before its click handler runs.
3. Add idempotent migrations for memo archive flags and the chat participant upsert conflict key.
4. Correct the Nurie `.NRE` catalog's encoding and renderer-scope claims without adding a runtime loader.
5. Run focused browser/Supabase checks and the full loop gate.

Exit criteria: the clickable `Tab` hint moves through the active editor fields, and a fresh migration replay produces the schema contracts used by memo and chat persistence.

## Blood hotspot keyboard parity and click harness repair (2026-08-29)

1. Reproduce the blood-type hotspot keyboard gap and duplicate activation path.
2. Add button semantics and a single delegated click/keyboard activation path.
3. Repair the standalone click-fill harness's ESM imports and browser stubs.
4. Add permanent browser assertions and rerun the full verification gate.

Exit criteria: blood-type input/result choices work with mouse, Enter, and Space, and the standalone click-fill harness completes its assertions.

## Fixed sysop recipient and NRE conversion smoke (2026-08-29)

1. Verify that clicking the readonly sysop recipient follows the existing subject-field flow.
2. Add a read-only smoke that converts Nurie's `@[` transport marker to `ESC[` and checks supported CSI consumption.
3. Assert every converted sentinel parses while allowing documented Nurie-specific extensions to remain unsupported.
4. Run browser, ANSI, Supabase, and full loop gates.

Exit criteria: `/guide/tosysop` fixed-recipient interaction and the `.NRE` reference boundary are both backed by repeatable checks.

## 다음 세션 재개 지점 (2026-08-29)

현재 안전한 코드·자료 정리 단계는 완료되었다. 다음 세션은 아래 순서로 재개한다.

1. 먼저 `git status --short`와 `git log -1 --oneline`을 확인한다. 현재 기준 `main` 워크트리는 깨끗하며, 이후 변경이 생기면 사용자 변경을 보존하고 `reset`, 광범위한 삭제, 무단 커밋을 하지 않는다.
2. 최신 근거는 `docs/PC통신_GO_호환성_카탈로그.md`, `docs/PC통신_자료_학습카탈로그.md`, `docs/ref_images/README.md`, `docs/종료공지/README.md`다. `GO CHATTING`, `GO BLUEHS`는 실제 `HITEL.MNU`와 현재 화면이 일치해 반영됐고, 나머지 동등 화면 없는 코드는 보류 상태다.
3. 코드 변경 전 `npm run loop:verify`를 기준선으로 실행한다. 변경 후에는 최소 `node --check`, 관련 smoke, `npm run build`, `npm run check`, `npm run qa:final`, `npm run smoke:full-traversal`을 다시 실행한다.
4. 다음 기능 후보는 (a) 추가 레거시 GO 코드를 실제 화면과 대조하는 작업, (b) 전 화면 키보드·마우스·힌트/오류 회귀 점검이다. 기능이 없는 원전 메뉴를 새로 만들지 않는다.
5. Supabase 공개 RPC 권한 회수, 함수 `search_path`, Auth 유출 비밀번호 보호, 운영 CORS allowlist는 외부 동작을 바꾸므로 사용자 운영 승인을 받은 뒤 별도 단계로 적용한다. 승인 전에는 읽기 전용 점검만 한다.

최신 기준선 결과: `npm test` 통과, `npm run build` 통과, `npm run check`에서 `liveReady: true`, `npm run qa:final` 통과, `npm run loop:verify` 24/24 통과, `npm run smoke:full-traversal` 콘솔 오류 없이 통과(기존 PDS fixture 404 warning 1건은 예상 범위).

## 모바일 터치·라우트 회귀 확장 (2026-08-31)

1. 기존 390/360/320px 레이아웃 검사에 실제 입력 화면(`/game/blood`, `/game/compat`, `/game/tojeong`, `/game/bio`)을 포함한다.
2. 각 viewport에서 TOP 메뉴 핫스팟, 혈액형 선택 터치, 쪽지 작성 진입·받는 사람 Enter 이동을 Playwright touch로 검증한다.
3. 모바일 검사를 `npm run smoke:mobile`로 재실행할 수 있게 하되, 빠른 24개 loop gate에는 포함하지 않아 기존 게이트 시간을 변경하지 않는다.
4. 모바일 smoke 실패 시 해당 viewport·route·interaction 단계만 수정하고 데스크톱 전체 회귀를 다시 확인한다.

Exit criteria: 390/360/320px에서 31개 핵심 경로가 가로·세로 클리핑 없이 로드되고, 대표 터치·입력 흐름이 모두 통과한다.

## 모바일 텍스트 넘침 보정 (2026-08-31)

1. Playwright Range 측정으로 문서 `scrollWidth`에 드러나지 않는 내부 텍스트 넘침까지 확인한다.
2. 320px에서 재현된 혈액형·토정비결 안내문의 색상 span `white-space: pre` 상속 문제를 모바일 범위에서만 `pre-wrap`/`overflow-wrap:anywhere`로 보정한다.
3. 게시물·뉴스·쪽지·약관·도움말·시삽 건의·작성 화면의 자유 텍스트 컨테이너에는 `min-width:0`과 줄바꿈 규칙을 적용한다. ANSI 고정폭 데스크톱 레이아웃은 변경하지 않는다.
4. 접근성용 clip 라벨과 ANSI 장식 구분선은 검사 대상에서 제외해 오탐을 막고, 실제 한글·영문·숫자 텍스트만 게이트로 삼는다.

Exit criteria: 390/360/320px 31개 경로에서 가시 텍스트의 viewport 외부 확장이 0건이고, `npm run smoke:mobile` 및 기존 전체 게이트가 통과한다.

## 모바일 터치 타깃·힌트 parity 보강 (2026-08-31)

1. 혈액형 semantic span과 회원가입 선택 버튼의 실제 박스 크기를 측정해 24px 미만이면 모바일 범위에서만 확대한다.
2. 힌트 토큰의 coarse-pointer pseudo hitbox가 인접 토큰을 가로막지 않도록 좁은 viewport에서 토큰 자체의 박스만 이벤트를 받게 한다.
3. 시삽 건의 validation이 실제 `tosysop-ed-subject` 입력을 찾아 제목 필드에 오류를 표시·포커스하도록 렌더러 ID를 일치시킨다.
4. smoke에 accessible name, touch target, TOSYSOP/게시글/게임 입력 parity를 추가하되 서버 데이터 저장이나 외부 메일 발송은 수행하지 않는다.

Exit criteria: 390/360/320px에서 24px 미만 visible control·이름 없는 control·힌트 토큰 intercept·입력 포커스 오류가 0건이며, 기존 전체 게이트가 통과한다.
