# PC통신 자료 학습 카탈로그

**LOG_ID: 20260827_1610**

`docs/`와 Nurie 자료를 서비스 개발에 활용할 때, 무엇을 확인했고 무엇을 아직 원본 수준으로 확인하지 않았는지 구분하기 위한 기준 문서다. 역사 자료를 그대로 복제하지 않고 현재 서비스의 기능·콘텐츠·UI에 대응되는 내용만 반영한다.

## 1. 학습 완료 또는 구현 기준으로 사용한 자료

| 자료군 | 대표 경로 | 확인한 내용 | 현재 반영 |
| --- | --- | --- | --- |
| 프로젝트 규칙 | `AGENTS.md`, `docs/README.md`, `.agents/skills/loop_engineering/SKILL.md` | Vanilla JS/Node/Supabase 구조, 80열 터미널, 힌트·프롬프트 보존, 검증 게이트 | 코드 수정·검증 기준 |
| 01410 UI | `docs/01410-ui-reference.md` | 고정형 터미널, 헤더·구분선·페이지 표기, 번호 목록, 하단 명령 힌트 | UI 레이아웃 기준 |
| 하이텔 원전 요약 | `docs/hitel_upgrade_plan.txt`, `docs/책_hitel길라잡이*` | GO, P/F/B/T, 게시판·쪽지·채팅·자료실 명령, 화면 사례와 구현 완료/보류 결정 | 명령·화면 회귀 기준. 초기 대문 작은공지와 GO NOTICE까지 반영 |
| 나우누리 원전 요약 | `docs/NOWNURI_*`, `docs/NOWNURI_MENUS/*` | CHATIN, 메뉴·쪽지·게시판 표기, 나우누리와 하이텔 융합 원칙 | 콘텐츠·명령 참고 |
| 명령어 비교 | `docs/PC통신_명령어_완전_정리.txt`, `docs/명령어_한국어_매핑.txt`, `docs/pc_communication_commands.html` | 3사 공통 명령과 통신사별 차이, GO 별칭 후보 | 검증된 별칭만 적용 |
| 구현 가이드 | `docs/USER_GUIDE_www-bbs.txt`, `docs/USER_GUIDE_olddos.txt`, `docs/USER_GUIDE_ezbbs.txt`, `docs/USER_GUIDE_coroke.txt` | 실제 서비스 흐름, 글쓰기·쪽지·채팅·인증·ANSI 관례 | 기능 검증 기준 |
| Nurie 소스/메뉴 | `nurie/HITEL.MNU`, `nurie-source/GOMENU.C` 등 | 메뉴 지도 구조와 GO 엔진 역할, `tojung`, `biorym`, `gunghap` 키워드 | GO 라우팅 반영 |
| Nurie ANSI 샘플 | `nurie/ANSI1.NRE`~`ANSI4.NRE` | 샘플 크기·SHA-256, 공통 CSI 제어 범위 | `ansiRenderUtils.js` 및 catalog 반영 |

## 2. 기존 OCR·복원 자료를 통해 학습한 범위

- `NOWNURI_ALL_DATA_RESTORED.txt`, `NOWNURI_SCREENS_FULL_DECODED.txt`는 복원된 메뉴·화면·명령 데이터로 사용한다.
- `메뉴-하이텔.txt`, `메뉴-천리안.txt`는 메뉴명·서비스 분류 비교용으로 사용한다.
- `책_hitel길라잡이*`와 PC통신 관련 OCR PDF는 `hitel_upgrade_plan.txt`에 정리된 장별 학습 요약과 구현 대조표를 우선 기준으로 삼는다.
- 이미 구현됐거나 사용자가 보류·제외한 항목(테마 전환, 프롬프트 교체, 빈 게시판 대량 추가 등)은 원전에 있더라도 자동 재제안하지 않는다.

## 3. 참고용으로 보관하고 원본 재검토가 필요한 자료

| 자료군 | 경로 | 현재 상태 | 다음 사용 조건 |
| --- | --- | --- | --- |
| OCR PDF 원본 | `docs/*.pdf` 및 책별 폴더 | 텍스트 요약·기존 OCR 기준 확인. 모든 페이지의 신규 OCR/화면 대조는 미완료 | 특정 기능을 추가할 때 해당 페이지를 다시 대조 |
| 01410 영상 | `docs/오늘 추억속으로 사라진 01410의 마지막 모습 - 푸른하늘 임묵 네이버 카페.mp4` | 오디오 제외 화면 패턴이 `01410-ui-reference.md`에 요약됨. 프레임 전체 전사는 미완료 | 배치·색상·상호작용을 확인할 때 필요한 구간만 추출 |
| 이미지 아카이브 | `docs/ref_images`, `docs/종료공지` | 2026-08-29 파일·크기·SHA-256 감사 완료. 초소형(160×100 미만) 0개, 폴더 간 중복 0개. 기존 수집본 일부는 직접 원본 URL 미기록 | 실제 화면 자산으로 채택할 때 개별 검증. 폴더 README의 출처 상태와 해시를 함께 확인 |
| 작업 기록 | `WORK_LOG.md` | 현재 변경의 근거와 보류 결정을 확인하는 감사 자료 | 기존 결정을 되돌리거나 회귀 원인을 조사할 때 참조 |

## 4. 반영 전 판단 규칙

1. 원전 명령은 현재 라우터와 실제 화면이 존재할 때만 별칭으로 연결한다.
2. 서비스에 없는 기능을 빈 메뉴·빈 게시판으로 만들지 않는다.
3. 키보드 명령 중심의 터미널 흐름을 유지하면서 마우스 접근성을 보완한다.
4. 힌트바·프롬프트·화면 밀도에 관한 사용자 결정을 우선한다.
5. Supabase 스키마·인증·RLS는 코드와 현재 환경을 함께 확인한 뒤 별도 검증한다.
6. 새 반영마다 관련 스모크와 `WORK_LOG.md` 기록을 남긴다.

역사 명령어 표(`PC통신_명령어_완전_정리.txt`, `명령어_한국어_매핑.txt`)에 남아 있는
`SET/CAP`, `PRINT`, `XX`, `EAR` 등의 표기는 원전·통신사별 참고값이다. 현재 서비스의
지원 명령과 동일하다고 간주하지 않으며, 현행 라우터와 스모크에서 확인된 별칭만 반영한다.
`EAR`는 대화방 문맥의 귓속말 형식처럼 문맥 한정으로만 동작할 수 있다.
채팅방의 `/Z` 다시보기 역시 채팅 전용 문맥 명령이며, 전역 명령 메타데이터와 도움말에는
노출하지 않는다.

## 5. 현재 학습 상태 요약

핵심 UI·명령·라우팅 자료는 구현 기준으로 학습되어 있다. 반면 대용량 PDF 원본의 전 페이지 재독, MP4 전체 프레임 분석, 이미지 전체 OCR은 아직 필요할 때 구간별로 수행하는 참고 단계다. 따라서 이후 작업에서는 이 구분을 지키고, 확인하지 않은 자료를 근거로 기능을 추측해 추가하지 않는다.

`docs/PC통신_GO_호환성_카탈로그.md`에 원전 GO 키워드와 현재 서비스 대상의 대조 결과, 그리고 동등 화면이 없어 보류한 키워드를 별도로 기록했다.

### 이미지 자산 감사 기준

- [`docs/ref_images/README.md`](ref_images/README.md)와 [`docs/종료공지/README.md`](종료공지/README.md)에 현재 파일 목록, 픽셀 크기, 바이트 수, SHA-256 앞 16자리를 기록했다.
- 원본 페이지가 확인된 종료 공지는 페이지 링크를 기록하고, 기존 검색 수집본처럼 직접 이미지 URL이 없는 파일은 `미기록(기존 수집본)`으로 명시했다. 확인하지 않은 URL을 새로 추정하지 않는다.
- 동일 파일 또는 같은 화면의 명확한 축소·재인코딩본 4개를 제거했다. 감사 후 인벤토리는 `ref_images` 15개와 `종료공지` 20개다.

## 6. 최근 반영 기준

- [2026-08-28] 원전 화면의 하단 명령 힌트와 본문 입력 오류를 분리하는 규칙을 게임 화면까지 확장했다. 잘못된 날짜·MBTI 입력은 본문 인라인 오류 행으로 표시하고, 전송·이동 등 하단 힌트는 유지한다.
- [2026-08-28] 원전 전자우편 `FW 번호 아이디`는 현재 쪽지 목록의 번호·수신자 흐름과 대응하므로 기존 전달 본문/작성 화면에 연결했다. 별도 전송 API나 빈 메뉴는 만들지 않았다.
### 2026-08-29 command parity follow-up

- The documented active-room `/l` and `/list` forms now reuse the existing leave-and-lobby flow; no new chat data model or message path was introduced.
### 2026-08-29 WHO/U follow-up

- The historical common `U` member lookup now reaches the existing active-user screen outside post-local `U` contexts.
### 2026-08-29 post-list reply follow-up

- The documented list-local `A 번호` reply form now reuses the existing `RE` target resolver and auth guard.
### 2026-08-29 command-help parity

- Help metadata now describes the context-sensitive `A`, `WHO/U`, and memo-list `FW 번호 아이디` forms already supported by the routers.
### 2026-08-29 chat-room footer follow-up

- The active chat-room footer now exposes working `/L` room-list and `/W` participant shortcuts as clickable tokens.
### 2026-08-29 recent-post filter follow-up

- The existing `NEW/NW` recent-post filter is now exposed as `새글(NEW)` in ordinary and unified PDS list footers.
- This is a discoverability-only change; the existing three-day `recent=3` query and list router remain unchanged.
### 2026-08-29 Nownuri CHATIN follow-up

- Nownuri's `CHATIN` entry command now normalizes to the existing `CHAT` lobby route.
- No parallel chat flow was introduced; active-room message priority and guest gating remain unchanged.
### 2026-08-29 numeric F follow-up

- The common `F 번호` direct-position form now maps to the existing `LS 번호` list lookup on post lists.
- Bare `F` pagination and other screen-local meanings remain unchanged.
### 2026-08-29 Nownuri GO CHATIN follow-up

- The Nownuri menu code `CHATIN` is now included in the canonical GO alias catalog and resolves to the existing chat lobby.

## 2026-08-28 공통 기능 안정화 후속

- 공통 채팅 점유수 점검에서 메모리 드라이버가 `authUserId`를 보존하지 않아 동일 회원의 다중 세션을 여러 명으로 세던 문제를 재현했다.
- 메모리 참여자에도 정규화된 Auth UUID를 저장하여 Supabase 드라이버와 동일한 hybrid occupancy 계약을 사용하도록 수정했다.
- 실제 AuthBridge 요청 컨텍스트와 같은 `authUserId`를 smoke fixture에 명시하고, 채팅·게시판·메뉴·렌더러·보안·복구 공통 검증을 다시 통과시켰다.

## 2026-08-29 Supabase 공통 흐름 검증 보완

- Supabase 채팅 회원 persistence smoke에서 프로필 fixture가 `authUserId`를 누락해 인증 회원이 게스트로 계산되는 문제를 재현했다.
- 실제 AuthBridge 컨텍스트와 동일하게 프로필 UUID를 `userId`와 `authUserId`에 함께 전달하도록 테스트 계약을 보완했다.
- 런타임 코드는 변경하지 않았으며, 인증 다중 세션·게스트 정원·참여자 정리 검증이 통과했다.

## 2026-08-29 쪽지 공통 입력 브라우저 검증

- 기존 `/memo` → `W` 편지쓰기 경로를 실제 Chromium에서 재현했다.
- 받는 사람·제목의 Enter 이동, 입력 행 클릭 포커스, 내용 누락 오류의 본문 인라인 표시와 하단 힌트 보존을 회귀 검증에 포함했다.
- 쪽지 저장·라우팅은 수정하지 않고 브라우저 검증 범위만 보강했다.

## 2026-08-29 쪽지 목록 클릭 브라우저 검증

- 결정적인 테스트 쪽지 1건을 메모리 응답으로 주입해 `RMAIL` 목록의 행 핫스팟을 실제 클릭했다.
- 클릭 결과가 기존 `memo-view` 화면으로 전환되는지 확인하고, 데이터베이스에는 쓰지 않았다.
- 편지쓰기 키보드·오류 표시 검증과 함께 전체 순회 게이트에 포함했다.

## 2026-08-29 힌트바 Tab 동작 및 NRE 범위 정정

- 작성 화면 힌트의 `Tab`은 명령어가 아니라 현재 편집 필드의 다음 칸으로 이동하는 UI 동작이다. 클릭 시 `TAB` 문자열을 명령 입력창에 채우지 않도록 전용 focus action으로 연결했다.
- `.NRE`는 CP949/Johab 계열 바이트와 `@[` sentinel을 사용하는 Nurie 파일 포맷이다. `ESC[`로 변환하지 않은 원본을 웹 ANSI renderer가 직접 지원한다고 해석하지 않도록 카탈로그의 적용 범위를 정정했다.

## 2026-08-29 혈액형 선택 키보드 parity

- 혈액형 입력·결과 화면의 A/B/O/AB 선택지는 마우스뿐 아니라 Enter/Space로도 실행되어야 하는 공통 핫스팟으로 분류했다.
- 실제 Chromium에서 버튼 semantics와 키보드 실행을 확인하고, 중복 mousedown 경로를 제거했다.

## 2026-08-29 NRE 변환 경계 smoke

- `ANSI1.NRE`~`ANSI4.NRE`를 읽어 `@[` sentinel을 `ESC[`로 변환하는 참고 경로를 smoke에 고정했다.
- 각 sentinel이 CSI로 파싱되고 HTML에 ESC가 남지 않는지만 검증하며, CP949/Johab 문자 복원과 Nurie 전용 그래픽 확장은 웹 서비스 지원으로 간주하지 않는다.

## 2026-09-02 핵심 사용자 흐름 브라우저 검증

- 메인 메뉴 클릭, 계층형 `GO`, 게시판·PDS 이동, 쪽지·시삽 건의 작성, 게임 입력을 실제 Chromium 흐름으로 재현했다.
- 데스크톱 전체 순회(`npm run smoke:full-traversal`)에서 콘솔 오류 없이 통과했으며, 입력 오류는 본문 인라인에 남고 하단 힌트는 보존되는지 확인했다.
- 모바일 320/360/390/430px touch viewport에서 31개 라우트, TOP·혈액형·쪽지 터치, 작성 화면 Enter/Tab/Escape, 긴 한글·URL 줄바꿈을 검증했다(`npm run smoke:mobile`).
- 이번 점검에서는 재현 가능한 UI 회귀가 발견되지 않아 런타임 코드는 변경하지 않았다. 이후 동일 흐름은 `npm run loop:verify`와 Production smoke로 재검증한다.
## 2026-09-02 Supabase 장애 복원력 및 입력 안전성

- Supabase 저장소 호출은 공통 fetch 래퍼에서 제한 시간(`SUPABASE_REQUEST_TIMEOUT_MS`)을 적용한다. 시간 초과는 504/`SUPABASE_TIMEOUT`, 네트워크·인증·권한·충돌·요청 제한·상위 서버 오류로 분류되어 사용자에게 안전한 안내만 노출된다.
- GET/HEAD/OPTIONS 읽기 요청만 제한된 재시도를 허용한다. POST/PUT/PATCH/DELETE 변경 요청은 자동 재시도하지 않으며, 같은 탭에서 동일 변경 요청을 동시에 중복 제출하지 않도록 in-flight 잠금을 사용한다.
- `/api/health`는 저장소별 상태와 지연 시간만 공개하고 원본 Supabase 오류 세부정보나 비밀값은 반환하지 않는다. 개별 점검도 별도 제한 시간 안에서 종료된다.
- 브라우저 오류는 본문 전용 `#terminal-error` 행과 명령 힌트바를 분리한다. 전역 오류가 힌트를 덮어쓰지 않으며, 인증 만료(401)는 게스트 예외를 제외하고 로그인 화면으로 복귀한다.
- `scripts/smoke-api-fetch.js`와 `scripts/smoke-supabase-resilience.js`가 재시도·타임아웃·오류 분류·동시 변경 잠금·health 제한을 fault-injection으로 검증한다. 전체 경로와 320/360/390/430px 모바일 스모크도 함께 실행한다.

## 2026-09-02 화면별 PC통신 UI·모바일 감사

- TOP, GUIDE, 게시판 목록·본문, 자료실, 쪽지함, 대화실, 뉴스·날씨, 게임, 도움말·정책 화면을 실제 Chromium 흐름으로 확인했다. 상단 브랜드/페이지 제목, 고정폭 ANSI 본문, 한 줄 구분선, 하단 명령 힌트·프롬프트의 공통 배치를 유지한다.
- 과거 북마크에서 사용한 `/guide/tosysop` 경로는 인증된 사용자에게 시삽 건의 편집기를 직접 복원하도록 별칭을 보강했다. 게스트의 건의하기 클릭은 기존 인증 요구 정책에 따라 GUIDE로 돌아가며 로그인 안내를 유지한다.
- 320/360/390/430px 세로 뷰포트에서 전체 31개 경로, 터치 클릭, Enter/Tab/Escape, 긴 문장 줄바꿈과 가로 오버플로를 점검했다.
- 모바일 게시판 목록에서 색상 span이 한 게시물 행을 여러 줄로 분리하던 문제를 수정했다. 목록 행은 ANSI 열 구조를 유지한 한 줄로 표시하고, 좁은 화면에서는 제목을 행 내부에서 잘라 열/번호 정렬을 보존한다.
- `npm run smoke:full-traversal` 및 `npm run smoke:mobile`에 위 딥링크·행 높이 회귀 검증을 추가했다.
