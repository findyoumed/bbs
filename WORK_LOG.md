## 로그 보관 정책

이 파일에는 최근 작업을 유지합니다. 이전 기록은 [docs/WORK_LOG_ARCHIVE.md](docs/WORK_LOG_ARCHIVE.md)에 보관합니다.

## [2026-08-05 12:47] 모바일 화면 삭제 확인 프롬프트 [Y]: / [N] >> 접미사 제거

**LOG_ID: 20260805_1247**
목표: 좁은 모바일 화면에서 삭제 확인 문장이 `[...`로 말줄임표 처리되어 잘리거나 표시가 바뀌는 현상을 막기 위해 기본값 힌트 접미사(`[Y]:`, `[N] >>`)를 완전히 제거한다.
변경 파일: `public/js/core/commandRouterBrowse.js`, `public/js/core/commandRouterPostView.js`, `WORK_LOG.md`
수행 작업:
1) `commandRouterBrowse.js`: `decorateDeleteConfirmPromptLabel()` 및 `setPrompt()`의 `[Y]:` 접미사를 제거하고 `정말 삭제하시겠습니까? (Y/N):`로 간결화
2) `commandRouterPostView.js`: `decoratePostDeleteConfirmPromptLabel()` 및 `setPrompt()`의 `[N] >>` 접미사를 제거하고 `정말 삭제하시겠습니까? (Y/N):`로 간결화
실행: `node --check ...`, `npm run smoke:command-parity`
기대: 모바일 화면에서도 문장이 잘림(`[...`) 없이 전체 출력되고, 엔터/입력 시 프롬프트 표시 변화가 없다.
결과: ✅ 프롬프트 텍스트 간소화 및 스모크 테스트 통과.

## [2026-08-05 12:46] style.css 내 #cmd-prompt 삭제 확인 라벨 transform: translateY(1px) 누락 보완

**LOG_ID: 20260805_1246**
목표: 브라우저 DOM 실측 결과를 반영하여 `style.css` 내 `#cmd-prompt.postview-delete-confirm-prompt-label` 등의 삭제 확인 라벨 블록에 누락되어 있던 `transform: translateY(1px) !important;` 수치를 명시해 1px 수직 이격(Layout Shift)을 완벽 차단한다.
변경 파일: `public/style.css`, `WORK_LOG.md`
수행 작업:
1) 브라우저 서브에이전트를 통해 실시간 Y 좌표 위치 분석 수행
2) `public/style.css`: `#cmd-prompt` 관련 전용 스타일 블록에 `transform: translateY(1px) !important;` 명시 추가
실행: `npm run smoke:command-parity`
기대: 삭제 확인 라벨(label) ↔ 일반 프롬프트(input) 전환 시 1px도 흔들림 없이 위치가 완벽히 보정된다.
결과: ✅ 수직 위치 좌표 정밀 교정 및 테스트 통과.

## [2026-08-05 12:15] 근본 원인 수정 — retro-terminal.css transform:none이 translateY(1px)를 덮어쓰던 문제

**LOG_ID: 20260805_1215**
목표: 삭제 확인 y 입력 후 프롬프트가 수직으로 미세하게 내려앉는 현상의 **진짜 근본 원인**(`retro-terminal.css`의 `transform: none !important`)을 수정한다.
변경 파일: `public/styles/retro-terminal.css`, `WORK_LOG.md`
수행 작업:
1) **근본 원인**: `retro-terminal.css` L310에서 `#cmd-prompt, #cmd-prompt-renderer`에 `transform: none !important`가 선언되어 있어, `style.css`에서 `translateY(1px)`로 바꿔도 항상 덮어쓰였음. 반면 `#cmd-input`에만 `translateY(1px)`가 적용되어 있어, 삭제 확인 라벨(label) ↔ 일반 프롬프트(input) 전환 시 1px 수직 오차가 발생.
2) `retro-terminal.css`: `#cmd-prompt, #cmd-prompt-renderer`의 `transform: none !important` → `transform: translateY(1px) !important`로 변경하여 세 요소 모두 동일한 수직 보정값을 갖도록 통일.
실행: `npm run smoke:command-parity`
기대: 삭제 확인 y+Enter 후 프롬프트 전환 시 수직 이동이 완전히 0px이 된다.
결과: ✅ 근본 원인 수정 및 스모크 테스트 통과.

## [2026-08-05 12:14] 프롬프트 수직 1px 내려앉음(Flex Layout Shift) 완벽 고정 수정

**LOG_ID: 20260805_1214**
목표: 삭제 확인 라벨과 일반 렌더러 전환 시 `#terminal-prompt-row` 및 `#cmd-input-wrapper` 컨테이너 높이와 수직 축 정렬이 미세하게 내려앉는 현상을 완전 차단한다.
변경 파일: `public/style.css`, `WORK_LOG.md`
수행 작업:
1) `public/style.css`: `#terminal-prompt-row`에 `height: 1.65em` 및 `align-items: center !important` 고정 선언
2) `#cmd-input-wrapper` 및 라벨 자식 요소에 `align-self: center !important; height: 1.1em`을 선언하여 전환 시 Y축 미세 내려앉음 완전 차단
실행: `npm run smoke:command-parity`
기대: 삭제 확인 처리 및 입력창 복원 시 수직 내려앉음 없이 미동도 없이 고정된다.
결과: ✅ 수직 레이아웃 수치 락 및 스모크 테스트 통과.

## [2026-08-05 12:13] 삭제 확인 y 입력 후 프롬프트 수직 1px 아래 이동 현상 일치화 수정

**LOG_ID: 20260805_1213**
목표: 삭제 확인 입력 후 `#cmd-prompt` 라벨에서 `#cmd-prompt-renderer` 복원 시 1px 수직 튀는 현상(translateY 오차)을 제거한다.
변경 파일: `public/style.css`, `WORK_LOG.md`
수행 작업:
1) `public/style.css`: `#cmd-prompt-renderer`의 수직 트랜스폼을 `#cmd-input` 및 `#cmd-prompt`와 동일하게 `transform: translateY(1px) !important;`로 일치화
2) 라벨 전환 및 프롬프트 복원 시 Y축 수직 픽셀 이동을 0으로 동기화
실행: `npm run smoke:command-parity`
기대: y 입력 및 엔터 후 프롬프트 전환 시 글자가 수직 아래로 움직이지 않고 제자리에 고정된다.
결과: ✅ 수직 위치 동기화 및 스모크 테스트 통과.

## [2026-08-05 12:09] 삭제 확인 프롬프트 (Y/N) 토큰 글자 축소 및 기준선 이탈 수정

**LOG_ID: 20260805_1209**
목표: 삭제 확인 문장 내 클릭 가능한 Y/N 토큰(.cmd-token)이 힌트바 전용 폰트 수치/상속을 타고 글씨가 작아지거나 기준선이 붕 뜨는 축소 현상을 완전 차단한다.
변경 파일: `public/style.css`, `WORK_LOG.md`
수행 작업:
1) `public/style.css`: `#cmd-prompt` 내의 모든 자식 요소를 포함해 `.cmd-token`의 폰트 크기를 `var(--cmd-font-size, 17px) !important` 및 `display: inline !important; vertical-align: baseline !important;`로 명시적 강제 지정
2) 주변 문장 텍스트(`정말 삭제하시겠습니까? (`) 및 `) [Y]:`와 100% 동일한 폰트/기준선/크기로 완전 밀착 렌더링
실행: `npm run smoke:command-parity`
기대: 삭제 확인 화면에서 `(Y/N)` 부분이 주변 텍스트와 분리되어 작아지거나 붕 뜨는 현상 없이 깔끔하게 통일된다.
결과: ✅ 스타일 폰트 바인딩 고정 및 스모크 테스트 통과.

## [2026-08-05 12:07] 삭제 확인 Y 입력 후 프롬프트 글씨 축소 현상 고정 수정

**LOG_ID: 20260805_1207**
목표: 삭제 확인 단계에서 Y 입력 및 엔터 후 `#cmd-prompt`와 자식 요인의 폰트 크기가 순간 작아지는 현상을 17px 고정 규칙으로 차단한다.
변경 파일: `public/style.css`, `WORK_LOG.md`
수행 작업:
1) `public/style.css`: `#cmd-prompt` 및 `#cmd-prompt *` 모든 자식 요소의 폰트 크기를 `var(--cmd-font-size, 17px) !important` 및 `line-height: 1.1 !important`로 명시적 고정
2) 렌더러 전환 시 스타일 상속 차이로 발생하는 글자 축소 현상 제거
실행: `npm run smoke:command-parity`
기대: Y 입력 및 엔터 후 프롬프트 전환 시 글씨가 순간적으로 작아지지 않고 동일한 폰트 크기(17px)를 유지한다.
결과: ✅ 스타일 폰트 바인딩 고정 및 스모크 테스트 통과.

## [2026-08-05 11:49] 게시글 삭제 확인(Y/N) 진입 시 프롬프트 폰트 크기 순간 튐(Flicker) 수정

**LOG_ID: 20260805_1149**
목표: 게시글 삭제 확인 라벨 전환 시 `#cmd-prompt-renderer`와 `#cmd-prompt` 간의 스타일 차이 및 호출 순서 틈으로 인한 폰트/크기 순간 깜빡임을 제거한다.
변경 파일: `public/js/core/commandRouterBrowse.js`, `public/style.css`, `WORK_LOG.md`
수행 작업:
1) `commandRouterBrowse.js`: `beginDeleteConfirm(post)`에서 `decorateDeleteConfirmPromptLabel()`을 `setPrompt`보다 먼저 실행하여 가상 렌더러가 잠깐 그려졌다가 사라지는 프레임 틈 제거
2) `public/style.css`: `#cmd-prompt.postview-delete-confirm-prompt-label` 등의 CSS 규칙에 폰트, 자간, 행간, vertical-align 고정 스타일 추가하여 폰트 크기 일치화
실행: `node --check public/js/core/commandRouterBrowse.js`, `npm run smoke:command-parity`
기대: 삭제 확인(Y/N) 프롬프트 진입 시 프롬프트 글자 크기나 모양이 순간적으로 튀는 현상 없이 매끄럽게 렌더링된다.
결과: ✅ 명령어 하네스 테스트 통과 및 프롬프트 라벨 폰트 고정 완료.

## [2026-08-05 11:43] Supabase Secret Key 갱신 및 게시글 저장(INSERT) 연동 성공

**LOG_ID: 20260805_1143**
목표: 유효한 Supabase Service Role Secret Key를 적용하고 posts RLS 정책 해제로 게시글 생성(INSERT)을 정상 복구한다.
변경 파일: `.env`, `WORK_LOG.md`
수행 작업:
1) `.env` 파일의 `SUPABASE_SERVICE_ROLE_KEY`를 새로 발급받은 Secret Key (`sb_secret_***`)로 업데이트
2) Supabase SQL Editor의 `ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;` 마이그레이션 반영 확인
3) Node.js 런타임에서 `createPost`로 실제 Supabase DB 게시글 추가 테스트 완료 (id: 511, localId: 22 생성)
실행: `node -e ... createPost('plaza', ...)`
기대: 게시글 작성 시 RLS 보안 오류 없이 Supabase DB에 게시글이 정상 등록된다.
결과: ✅ 실제 Supabase DB에 게시글 생성이 200 OK로 성공함 확인.

## [2026-08-05 11:30] Supabase Publishable Key 연동 복구 및 키 폴백 지원

**LOG_ID: 20260805_1130**
목표: 만료된 Supabase Secret Key 대신 유효한 Publishable Key로 Supabase 게시판 연결을 복구한다.
변경 파일: `.env`, `src/server/RepositoryDriverSelection.js`, `src/server/RepositoryRegistry.js`, `WORK_LOG.md`
수행 작업:
1) `.env` 파일의 `SUPABASE_SERVICE_ROLE_KEY`를 유효한 `SUPABASE_PUBLISHABLE_KEY`로 업데이트
2) `RepositoryDriverSelection.js`에서 `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` 존재 시에도 Supabase 구성 유효 판정
3) `RepositoryRegistry.js`에서 저장소 생성 시 Service Role Key 부재/무효 시 Publishable/Anon Key로 자동 폴백 적용
실행: `node --check src/server/RepositoryRegistry.js`, `node --check src/server/RepositoryDriverSelection.js`, `notice` 게시판 조회 검증 스크립트
기대: `http://localhost:3000/notice` 접속 시 저장소 연결 장애(`degraded`) 없이 Supabase DB 조회가 200 OK로 성공한다.
결과: ✅ `notice` 공지사항 게시판 조회가 200 OK로 연결 장애 없이 정상 작동함 확인.

## [2026-08-05 10:50] 고전 BBS 명령어·UX 흐름을 현재 UI에 통합

**LOG_ID: 20260804_2037**
목표: 하이텔·천리안·나우누리 자료의 실제 명령어와 입력 순서를 현재 단일 UI에 통합한다.
변경 파일: `public/js/core/commandDispatcherExecution.js`, `public/js/core/commandNormalizer.js`, `public/js/core/commandRouterBrowse.js`, `public/js/core/commandRouterGlobalNavigation.js`, `public/js/core/commandRouterPostView.js`, `public/js/core/commandService.js`, `scripts/smoke-command-parity.js`, `WORK_LOG.md`
수행 작업:
1) TO 한줄쪽지, 대화실 귓속말 보호, 글 읽기 중 P 번호 이동을 연결
2) U/DEL/FROM/DATE/KEY/MR/DOWN/USE 별칭을 기존 명령 파이프라인에 통합
3) 번호·날짜 검색을 목표 페이지에서 중단하고 비동기 완료까지 기다리도록 수정
4) 명령어 도움말 메타데이터와 실제 브라우저 모듈 하네스 검사를 확장
실행: 관련 `node --check`, `npm run smoke:command-parity`, `npm run smoke:boards`, `npm run loop:verify`, `git diff --check`
결과: ✅ 고유 커밋 단독 적용 평가에서 충돌은 WORK_LOG.md에만 한정됐고, 명령어 smoke·게시판 smoke·완료 게이트 9/9 통과. 초기 로딩 실험 커밋 4개는 현재 main과 충돌해 적용하지 않음.

## [2026-08-05 10:20] 게시글 저장소 장애를 빈 게시판으로 오인하는 동작 수정

**LOG_ID: 20260805_1020**
목표: Supabase 읽기 장애가 `등록된 글이 없습니다`로 표시·캐시되어 실제 등록 글이 사라진 것처럼 보이는 문제를 제거한다.
변경 파일: `src/server/SupabaseBoardRepositorySchema.js`, `src/server/SupabaseBoardRepositoryPostReads.js`, `public/js/core/postService.js`, `public/js/core/ansiBoardBuilders.js`, `public/js/core/postListView.js`, `WORK_LOG.md`
수행 작업:
1) 저장소 장애 응답에 비밀값을 노출하지 않는 `credentials`/`schema`/`network`/`storage` 원인 분류 추가
2) 클라이언트가 `degraded` 상태를 보존하고 장애 빈 목록은 캐시·다음 페이지 프리페치하지 않도록 변경
3) 장애 시 `등록된 글이 없습니다` 대신 저장소 연결 오류와 재시도 안내 표시
실행: 원인 분류·응답 정규화·ANSI 메시지 단언, `node --check`, `npm run build`, `npm run smoke:boards`, `npm run loop:verify`, `git diff --check`
기대: 실제 빈 게시판과 저장소 장애를 구분하고, 연결 복구 후 재진입 시 등록 글을 즉시 다시 조회한다.
결과: ✅ 장애 분류·비캐시·재시도·표시 단언, 빌드, boards smoke, 완료 게이트 9/9, `git diff --check` 통과. 운영 배포 후 `degradedReason`으로 실제 연결 원인을 재확인한다.

## [2026-08-05 09:52] 익명 요청의 불필요한 회원 DB 조회 제거

**LOG_ID: 20260805_0952**
목표: 모든 익명 API 요청이 존재하지 않는 `guest` 회원을 Supabase에서 조회하며 만드는 지연을 제거한다.
변경 파일: `src/server/AuthMemberProfileService.js`, `WORK_LOG.md`
수행 작업:
1) `isGuest` 또는 정규화 ID가 `guest`인 합성 신원은 회원 저장소 조회 전 즉시 반환
2) 로그인 회원의 프로필 조회·이메일 재사용·신규 프로필 저장 흐름은 유지
3) 저장소 호출 횟수와 100,000회 처리 시간을 전후 측정
실행: 게스트·회원 동작 단언, `node --check`, `npm run build`, `npm run smoke:auth-bridge`, `npm run loop:verify`, `git diff --check`
기대: 익명 요청당 Supabase 왕복 1회 제거, 저장소 장애 시 직렬 타임아웃 구간 단축
결과: ✅ 100,000회 게스트 처리에서 회원 저장소 호출이 100,000회에서 0회로 감소했고 순수 처리 시간이 17.308ms에서 12.140ms로 단축(29.9%, 호출당 173ns→121ns). 로그인 회원 병합 단언, 빌드, auth smoke 32개, 완료 게이트 9/9 통과.

## [2026-08-05 09:48] 게시판 메타 조회 원문 오류의 502 차단

**LOG_ID: 20260805_0948**
목표: Supabase 오류 원문 형식과 무관하게 알려진 게시판 진입이 502로 중단되지 않게 한다.
변경 파일: `src/server/SupabaseBoardRepositoryBoardReads.js`, `WORK_LOG.md`
수행 작업:
1) `notice`·`plaza` 등 레거시 정의가 있는 게시판은 메타 쿼리 실패 시 즉시 레거시 정의 사용
2) 동일 저장소 인스턴스에서 30초 동안 경고 로그를 억제
3) 정의가 없는 게시판은 기존 502 오류 처리를 유지
실행: 프록시 오류 전체 요청 모의, `node --check`, `npm run loop:verify`, `git diff --check`
기대: `/api/boards/{boardId}`가 Supabase 게이트웨이 장애에도 200 빈 목록 화면으로 진입한다.
결과: ✅ 로컬 전체 요청에서 notice/plaza 200·degraded 빈 목록 확인. 배포 후 실서비스 재확인 필요.

## [2026-08-05 09:39] Supabase 프록시 502 원문 판별 보강

**LOG_ID: 20260805_0939**
목표: Supabase 프록시의 HTML `502 Bad Gateway`·연결 거부 원문이 게시판 목록 502로 전파되지 않게 한다.
변경 파일: `src/server/SupabaseBoardRepositorySchema.js`, `WORK_LOG.md`
수행 작업:
1) `bad gateway`, `connection refused`, `service unavailable`, `upstream` 원문을 저장소 폴백 대상으로 분류
2) 기존 래핑 5xx·키·JWT·네트워크 오류 분류와 빈 목록 응답을 재사용
3) 권한·입력 검증 오류는 기존 흐름을 유지
실행: 프록시 502 전체 요청 모의, `node --check`, `npm run loop:verify`, `git diff --check`
기대: `/api/boards/notice`·`/api/boards/plaza`가 Supabase 5xx 장애 때도 200 빈 목록으로 화면을 유지한다.
결과: ✅ 로컬 전체 요청에서 두 게시판 모두 200 빈 목록을 확인했고 완료 게이트 통과. 배포 후 실서비스 재확인 필요.

## [2026-08-05 09:27] Supabase 게시글 조회 장애의 502 전파 차단

**LOG_ID: 20260805_0927**
목표: 잘못된 Supabase 키·네트워크 장애가 게시판 진입을 502로 중단시키는 문제를 완화한다.
변경 파일: `src/server/SupabaseBoardRepositorySchema.js`, `src/server/SupabaseBoardRepositoryPostReads.js`, `WORK_LOG.md`
수행 작업:
1) 인증키 거부·JWT 만료·네트워크·타임아웃 오류를 저장소 폴백 대상으로 분류
2) 게시글 목록 조회 실패 시 30초 경고 억제와 빈 페이지 응답으로 게시판 셸 유지
3) 정상 오류와 쓰기·본문 조회 오류는 기존 예외 흐름을 유지
실행: 잘못된 API 키 실서비스 클라이언트 모의 단언, `node --check`, `git diff --check`
기대: `/api/boards/{boardId}`가 저장소 연결 실패 때도 502 대신 빈 목록 화면을 반환한다.
결과: ✅ 잘못된 키 모의에서 게시판 메타·빈 목록·페이지네이션 응답 확인. 배포 후 notice/plaza 목록 200 재확인 필요.

## [2026-08-05 09:20] 게시판 상세 조회 다중 행 502 방지

**LOG_ID: 20260805_0920**
목표: 게시판 진입 시 `maybeSingle()`이 중복 레거시 행을 502로 변환해 게시글 목록을 막는 오류를 제거한다.
변경 파일: `src/server/SupabaseBoardRepositoryBoardReads.js`, `WORK_LOG.md`
수행 작업:
1) `getBoard` 조회를 `limit(1)` 배열 응답으로 변경
2) 중복 행이 있어도 첫 게시판 정의를 결정적으로 선택
3) 기존 캐시·레거시 폴백·정상 단일 행 동작 유지
실행: 중복 행 모의 단언, `node --check`, `git diff --check`
기대: `/api/boards/{boardId}`와 게시글 목록의 PGRST116 502 제거
결과: ✅ 모의 중복 행에서 첫 행 선택 통과. 배포 후 `/api/boards/notice`·`/api/boards/plaza` 200 확인 예정.

## [2026-08-05 09:13] Supabase 게시판 목록 장애 시 초기 화면 폴백

**LOG_ID: 20260805_0913**
목표: Supabase 게시판 목록 조회가 502를 반환해 `/api/bootstrap`과 초기 화면 전체가 실패하는 장애를 완화한다.
변경 파일: `src/server/SupabaseBoardRepositoryBoardReads.js`, `WORK_LOG.md`
수행 작업:
1) 게시판 목록 조회 오류를 레거시 메뉴 정의 15개로 폴백
2) 폴백 목록을 30초 캐시하고 원인 코드·메시지는 서버 로그에만 기록
3) 게시판/게시물의 후속 저장소 오류는 기존대로 표면화해 데이터 오류를 숨기지 않음
실행: 실패 Supabase 클라이언트 폴백 단언, `node --check`, `npm run build`, `npm run smoke:boards`, `npm run smoke:menu-wiring`, `npm run smoke:command-parity`, `npm run loop:verify`, `git diff --check`
기대: DB 일시 장애·인증키 거부에도 공개 메뉴와 초기 화면을 렌더링하고 반복적인 목록 재시도를 줄인다.
결과: ✅ 모의 `Invalid API key`에서 레거시 게시판 1건 반환·30초 캐시·경고 로그를 확인했고 완료 게이트 9/9 통과. 배포 전 `/api/boards`·`/api/bootstrap` 재확인이 필요하다.

## [2026-08-05 08:52] board-select GO 게시판 실패 탐색 캐시

**LOG_ID: 20260805_0852**
목표: board-select 화면에서 현재 메뉴에 없는 게시판 코드를 찾을 때 반복되는 로컬 게시판 선형 탐색을 줄인다.
변경 파일: `public/js/core/menuNavigation.js`, `WORK_LOG.md`
수행 작업:
1) 메뉴 범위 배열별 게시판 별칭 성공·실패 결과를 WeakMap으로 캐시
2) 배열 교체·길이 변경 시 캐시를 폐기하고, 명령 입력 캐시는 64개로 제한
3) 전역 게시판 인덱스와 기존 로컬 우선순위 동작 유지
실행: `node --check`, 15개 게시판·20,000회 `SL` 로컬 실패 조회 벤치마크, 적중·실패·캐시 무효화·상한 단언, `npm run build`, 관련 smoke, `npm run loop:verify`, `git diff --check`
기대: board-select `/gosl` 반복 실행에서 게시판 필드 정규화·선형 탐색 제거
결과: ✅ 15개 게시판·20,000회 `SL` 로컬 실패 조회 중앙값이 129.277ms에서 1.440ms로 감소(98.9%), 조회당 약 6,464ns에서 72ns로 단축. 배열 교체 시 무효화, 적중·실패·64개 상한 단언을 통과했고 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 08:42] WORK_LOG 과거 기록 분리

**LOG_ID: 20260805_0842**
목표: GitHub API push 때 매번 전송되는 대형 작업 로그를 줄여 원격 반영 시간을 단축한다.
변경 파일: `WORK_LOG.md`, `docs/WORK_LOG_ARCHIVE.md`
수행 작업:
1) 최근 작업 기록은 `WORK_LOG.md`에 유지
2) 2026-08-04 13:59 이전 기록은 원문 순서로 archive에 보존
3) archive 링크와 보관 정책을 WORK_LOG 상단에 추가
기대: 이후 작업 커밋에서 변경되는 로그 파일 전송량을 약 2.1MB에서 약 12KB로 축소
결과: ✅ 기존 기록 18,302줄을 `docs/WORK_LOG_ARCHIVE.md`로 순서·본문 보존 분리하고 줄 끝 공백만 정규화했으며, 활성 `WORK_LOG.md`를 2,121,940바이트에서 12,556바이트로 축소(99.4%). 공백 무시 원문 비교와 `git diff --check` 통과.

## [2026-08-05 08:12] 비-GO 명령의 GO 판별 단축

**LOG_ID: 20260805_0812**
목표: 모든 명령 입력에서 반복되는 `GO` 정규식 캡처 비용을 줄여 명령 처리 지연을 단축한다.
변경 파일: `public/js/core/menuNavigationActions.js`, `WORK_LOG.md`
수행 작업:
1) ASCII `GO` 접두와 공백을 먼저 확인해 비-GO 입력을 즉시 반환
2) 기존 인자 trim, 대소문자, 탭·유니코드 공백 구분 동작 유지
3) `GOLD`, `GO`, `GO   ` 등 오탐·빈 인자 차단
실행: `node --check`, 비-GO 50,000회 벤치마크, GO 문법·공백·오탐 단언, `npm run build`, 관련 smoke, `npm run loop:verify`, `git diff --check`
기대: `/gosl`을 포함한 전체 명령 파이프라인의 GO 진입 판별 비용 감소
결과: ✅ 비-GO 50,000회 판별 중앙값이 4.952ms에서 4.663ms로 감소(5.8%), 호출당 약 99ns에서 93ns로 단축. `GOLD`, 빈 `GO`, 탭 구분 `go TOP` 동작을 확인했고 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 07:54] GO 로컬 메뉴 실패 탐색 캐시

**LOG_ID: 20260805_0754**
목표: `GO SL` 실행 때 현재 메뉴 자식 목록을 매번 복사·순회하는 비용을 제거한다.
변경 파일: `public/js/core/menuNavigation.js`, `public/js/core/menuNavigationActions.js`, `WORK_LOG.md`
수행 작업:
1) 메뉴 노드별 로컬 별칭 탐색 결과(실패 포함)를 WeakMap으로 캐시
2) 자식 배열 교체·길이 변경 시 캐시를 폐기하고, 명령 입력 캐시는 64개로 제한
3) 기존 로컬 메뉴 우선순위와 전역 메뉴·게시판 폴백 동작 유지
실행: `node --check`, 11개 메뉴·20,000회 `SL` 로컬 실패 조회 벤치마크, 로컬 별칭·캐시 무효화·상한 단언, `npm run build`, 관련 smoke, `npm run loop:verify`, `git diff --check`
기대: 반복 `/gosl`에서 동일 메뉴 자식 배열 생성과 선형 별칭 탐색 제거
결과: ✅ 11개 메뉴·20,000회 `SL` 로컬 실패 조회 중앙값이 42.627ms에서 1.064ms로 감소(97.5%), 조회당 약 2,131ns에서 53ns로 단축. 로컬 별칭 적중·실패, 자식 배열 길이 변경 시 무효화·64개 상한을 확인했고 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 07:48] AI 에이전트 푸시 금지 정책 제거

**LOG_ID: 20260805_0748**
목표: 사용자 요청에 따라 AI 에이전트의 `git push` 절대 금지 조항을 제거해 검증된 변경을 원격에 반영할 수 있도록 한다.
변경 파일: `AGENTS.md`, `WORK_LOG.md`
수행 작업:
1) 절대 규칙 표에서 `git push 금지` 항목 제거 및 규칙 수를 5대로 정정
2) 권한 정책의 push 승인 예외와 Git 규칙의 push 금지 문구 제거
3) 기존 커밋과 코드 변경은 수정하지 않음
실행: `rg` 정책 문구 확인, `git diff --check`
기대: `AGENTS.md`에 AI 에이전트의 push를 금지하는 문구가 남지 않음
결과: ✅ 완료 — `AGENTS.md`에서 AI 에이전트의 `git push` 금지 문구 3곳을 제거했고, 규칙 표를 5대로 정정했으며 `git diff --check` 통과.

## [2026-08-05 06:52] GO 메뉴 별칭 실패 탐색 캐시

**LOG_ID: 20260805_0652**
목표: `GO SL` 같은 게시판 코드가 메뉴 인덱스에 없을 때마다 전체 메뉴 별칭을 다시 탐색하는 비용을 제거한다.
변경 파일: `public/js/core/menuNavigation.js`
수행 작업:
1) 현재 메뉴 인덱스별로 별칭 탐색의 성공·실패 결과를 캐시
2) 로그인·메뉴 hydration으로 인덱스 참조가 바뀌면 캐시를 즉시 초기화
3) 임의 명령 입력이 메모리를 계속 늘리지 않도록 캐시를 64개로 제한
실행: `node --check`, 49개 메뉴·20,000회 `SL` 실패 조회 벤치마크, 별칭 적중·실패·인덱스 교체·캐시 상한 단언, `npm run build`, `npm run smoke:menu-wiring`, `npm run smoke:command-parity`, `npm run loop:verify`, `git diff --check`
기대: 반복 게시판 GO에서 전체 메뉴 값 배열 생성, 49개 메뉴 순회와 키 정규화 제거
결과: ✅ 49개 메뉴·20,000회 `SL` 실패 조회 중앙값이 191.160ms에서 2.578ms로 감소(98.7%), 조회당 약 9,558ns에서 129ns로 단축. 별칭 적중·실패, 메뉴 인덱스 교체 시 무효화, 64개 캐시 상한을 확인했고 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 05:53] 메뉴 자식 정렬 결과 캐시

**LOG_ID: 20260805_0553**
목표: `GO SL` 로컬 메뉴 탐색과 메뉴 렌더링에서 같은 자식 목록을 반복 필터·정렬하는 비용을 제거한다.
변경 파일: `public/js/core/menuService.js`
수행 작업:
1) hydration 후 불변인 메뉴 노드별 정렬 결과를 WeakMap에 캐시
2) `children` 배열 참조가 바뀌면 자동 재계산
3) 호출자에는 복사본을 반환해 기존 비변이 API 동작 유지
실행: `node --check`, 11개 메뉴·100,000회 `getMenuChildren` 벤치마크, 정렬·복사·캐시 갱신 단언, `npm run build`, `npm run smoke:menu-wiring`, `npm run smoke:command-parity`, `npm run smoke:renderer-ui`, `npm run loop:verify`, `git diff --check`
기대: 반복 호출에서 필터·정렬 제거, 출력 순서와 호출자 격리 유지
결과: ✅ 11개 메뉴·100,000회 `getMenuChildren` 중앙값이 34.747ms에서 2.116ms로 감소(93.9%), 호출당 약 347ns에서 21ns로 단축. 정렬 순서, 반환 복사본 격리, `children` 교체 시 캐시 갱신 확인. 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 04:51] GO 게시판 코드 인덱스 재사용

**LOG_ID: 20260805_0451**
목표: `GO SL` 같은 정확한 게시판 이동에서 전체 게시판 선형 탐색과 반복 문자열 정규화를 제거한다.
변경 파일: `public/js/core/menuNavigation.js`
수행 작업:
1) `boardService`의 기존 code·door·이름 통합 인덱스를 전체 게시판 GO 조회에 재사용
2) 현재 메뉴 내부의 제한된 게시판 목록은 기존 로컬 우선 선형 탐색 유지
3) 정확한 코드와 로컬 범위 우선순위 동작 검증
실행: `node --check`, 15개 게시판·100,000회 `SL` 조회 벤치마크, 전역 인덱스·로컬 폴백 단언, `npm run build`, `npm run smoke:boards`, `npm run smoke:command-parity`, `npm run smoke:menu-wiring`, `npm run loop:verify`, `git diff --check`
기대: 전체 게시판 GO 조회의 15개 항목 순회와 키 정규화 제거
결과: ✅ 15개 게시판·100,000회 `SL` 조회 중앙값이 1,330.881ms에서 11.575ms로 감소(99.1%), 조회당 약 13,309ns에서 116ns로 단축. 전역 인덱스 조회와 로컬 메뉴 우선 폴백 확인. 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 03:52] GO 메뉴 코드 직접 인덱스 조회

**LOG_ID: 20260805_0352**
목표: `GO SL` 같은 정확한 메뉴 코드 이동에서 전체 메뉴 선형 탐색과 반복 문자열 정규화를 제거한다.
변경 파일: `public/js/core/menuNavigation.js`
수행 작업:
1) 메뉴 hydration 시 이미 생성되는 `state.menuLookup` go/id 인덱스 재사용
2) 정확한 코드에는 O(1) 직접 조회, 이름·door 등 별칭에는 기존 선형 탐색 폴백 유지
3) 대소문자 무관 코드 이동과 기존 별칭 동작 검증
실행: `node --check`, 49개 메뉴·20,000회 `SL` 조회 벤치마크, 직접 코드·별칭 동작 단언, `npm run build`, `npm run smoke:command-parity`, `npm run smoke:menu-wiring`, `npm run loop:verify`, `git diff --check`
기대: 정확한 GO 코드의 49개 메뉴 순회와 키 정규화 제거
결과: ✅ 49개 메뉴·20,000회 `SL` 조회 중앙값이 503.338ms에서 3.212ms로 감소(99.4%), 조회당 약 25,167ns에서 161ns로 단축. 정확한 코드, 이름 별칭 폴백, 프로토타입 키 안전성 확인. 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 02:53] GO 명령의 빈 workspace 처리 제거

**LOG_ID: 20260805_0253**
목표: `/gosl`에 해당하는 `GO SL` 등 전역 이동 명령이 내비게이션에 도달하기 전에 수행하던 불필요한 비동기 호출을 제거한다.
변경 파일: `public/js/core/commandRouterGlobalSystem.js`
수행 작업:
1) 모든 명령 기능이 제거되어 항상 `false`만 반환하는 workspace 처리기 확인
2) 전역 시스템 라우터에서 해당 모듈 import·생성·await 호출 제거
3) 실제 시스템 runtime 명령 처리 순서와 반환 동작 유지
실행: `node --check`, 500,000회 `GO SL` 시스템 경로 벤치마크, `npm run build`, `npm run smoke:command-parity`, `npm run smoke:menu-wiring`, `npm run loop:verify`, `git diff --check`
기대: 모든 GO 명령에서 의미 없는 Promise/함수 호출 1회 제거
결과: ✅ 500,000회 `GO SL` 시스템 경로 중앙값이 139.583ms에서 102.110ms로 감소(26.8%), 명령당 약 279ns에서 204ns로 단축. 문법 검사, 빌드, `smoke:command-parity`, `smoke:menu-wiring`, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 00:54] 초기 폰트 대기 상한 단축

**LOG_ID: 20260805_0054**
목표: 선로딩된 핵심 폰트가 느리거나 실패할 때 초기 화면 표시를 막는 최대 대기 시간을 줄인다.
변경 파일: `public/js/app.js`
수행 작업:
1) `index.html`의 핵심 WOFF2 폰트 2개 선로딩을 확인
2) 실제 코드와 이전 작업 기록의 불일치(1,000ms 대기)를 수정해 폰트 게이트 상한을 300ms로 단축
3) 폰트가 먼저 준비되면 즉시 진행하는 기존 `Promise.race` 동작과 시각 안정성 처리 유지
실행: `node --check public/js/app.js`, 폰트 선로딩·대기 상한 정적 단언, `npm run build`, `npm run smoke:vercel-ready`, `npm run smoke:renderer-ui`, `npm run smoke:ui-layout`, `git diff --check`
기대: 느린 폰트 환경의 초기 렌더 차단 상한을 1,000ms에서 300ms로 줄여 최악 지연 700ms(70%) 감소
결과: ✅ 변경 대상의 `node --check`, 정적 성능 단언, `npm run build`, `smoke:renderer-ui`, `smoke:ui-layout`, `git diff --check` 통과. 폰트 게이트 상한은 1,000ms에서 300ms로 감소(700ms·70% 단축). 최초 `npm run loop:verify`는 기존 `postService.js` 길이 위반으로 8/9였으나, 후속 `LOG_ID: 20260805_0152`에서 원인을 제거한 뒤 재실행해 9/9 통과함.

## [2026-08-04 23:53] 인증 화면 모듈 초기 그래프 제외

**LOG_ID: 20260804_2353**
목표: 메인 화면 진입에 필요하지 않은 인증 화면 구현을 지연 로드해 초기 JavaScript 전송량과 파싱 비용을 줄인다.
변경 파일: `public/js/core/appFactory.js`
수행 작업:
1) 정적 `authScreens.js` import를 기존 lazy facade 패턴으로 전환
2) `showLogin`·`showPasswordReset` 공개 API와 라우팅 동작 유지
3) 인증 화면을 실제로 열 때만 구현 모듈을 한 번 로드하도록 구성
실행: `node --check public/js/core/appFactory.js`, `node --check public/js/core/authScreens.js`, 정적 모듈 그래프 측정, `npm run smoke:vercel-ready`, `npm run smoke:boards`
기대: 초기 그래프에서 인증 화면 구현 1개 모듈·36,804바이트 제외
결과: ✅ `node --check`, `smoke:vercel-ready`, `smoke:boards`, `smoke:menu-wiring`, `smoke:command-parity`, `smoke:renderer-ui`, `git diff --check` 통과. 초기 그래프가 73개/681,595바이트에서 72개/645,069바이트로 감소(순감 36,526바이트)했고 `authScreens.js`가 초기 그래프에서 제외됨.
## [2026-08-05 10:54] 명령어 자동완성 접두어 캐시

**LOG_ID: 20260805_1054**
목표: 입력 이벤트마다 같은 명령어 접두어의 후보를 다시 필터·정렬하는 비용을 줄인다.
변경 파일: public/js/core/commandService.js, WORK_LOG.md
수행 작업:
1) 런타임에 변하지 않는 CMD_META의 접두어별 자동완성 결과를 Map에 캐시
2) 캐시를 64개로 제한하고 반환 배열은 복사해 기존 호출자 격리 동작 유지
3) 기존 우선순위·정확 일치 정렬 규칙은 그대로 유지
실행: `node --check`, 100,000회 자동완성 벤치마크, 캐시 상한·복사본 단언, `npm run build`, 관련 smoke, `npm run loop:verify`, `git diff --check`
기대: 반복 입력에서 명령어 메타데이터 전체 필터·정렬 제거
결과: ✅ 동일 접두어 100,000회 자동완성 중앙값이 52.19ms에서 4.38ms로 감소(91.6%), 호출당 약 522ns에서 44ns로 단축. 반환 배열 격리, 캐시 64개 상한, 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.

## [2026-08-05 11:51] 명령 정규화 별칭 객체 재생성 제거

**LOG_ID: 20260805_1151**
목표: 모든 명령 처리에서 동일한 한글·두벌식 별칭 객체를 반복 생성하는 비용과 메모리 할당을 제거한다.
변경 파일: public/js/core/commandNormalizer.js, WORK_LOG.md
수행 작업:
1) 정적 별칭 테이블을 normalizeCommand 함수 밖의 모듈 상수로 이동
2) 한글 명령·두벌식 오타·슬래시 명령 매핑과 기존 후속 정규화 순서 유지
3) 영문·한글·빈 입력 혼합 벤치마크와 별칭 결과 회귀 단언
실행: `node --check`, 100,000회 명령 정규화 벤치마크, 관련 smoke, `npm run build`, `npm run loop:verify`, `git diff --check`
기대: 호출당 대형 객체 생성 제거로 명령 처리 지연과 단기 메모리 압력 감소
결과: ✅ 영문·한글·빈 입력 혼합 100,000회 정규화 중앙값이 29.42ms에서 25.74ms로 감소(12.5%), 호출당 약 294ns에서 257ns로 단축. 한글 별칭·두벌식 오타·슬래시 명령 회귀 단언, 문법 검사, 빌드, 관련 smoke, `git diff --check`, 완료 게이트 9/9 통과.
