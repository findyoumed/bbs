# PC통신 자료 학습 카탈로그

**LOG_ID: 20260827_1610**

`docs/`와 Nurie 자료를 서비스 개발에 활용할 때, 무엇을 확인했고 무엇을 아직 원본 수준으로 확인하지 않았는지 구분하기 위한 기준 문서다. 역사 자료를 그대로 복제하지 않고 현재 서비스의 기능·콘텐츠·UI에 대응되는 내용만 반영한다.

## 1. 학습 완료 또는 구현 기준으로 사용한 자료

| 자료군 | 대표 경로 | 확인한 내용 | 현재 반영 |
| --- | --- | --- | --- |
| 프로젝트 규칙 | `AGENTS.md`, `docs/README.md`, `docs/LOOP_ENGINEERING.md` | Vanilla JS/Node/Supabase 구조, 80열 터미널, 힌트·프롬프트 보존, 검증 게이트 | 코드 수정·검증 기준 |
| 01410 UI | `docs/01410-ui-reference.md` | 고정형 터미널, 헤더·구분선·페이지 표기, 번호 목록, 하단 명령 힌트 | UI 레이아웃 기준 |
| 하이텔 원전 요약 | `docs/hitel_upgrade_plan.txt`, `docs/책_hitel길라잡이*` | GO, P/F/B/T, 게시판·쪽지·채팅·자료실 명령, 화면 사례와 구현 완료/보류 결정 | 명령·화면 회귀 기준. 초기 대문 작은공지와 GO NOTICE까지 반영 |
| 나우누리 원전 요약 | `docs/nownuri_merge_plan.txt`, `docs/NOWNURI_*`, `docs/NOWNURI_MENUS/*` | CHATIN, 메뉴·쪽지·게시판 표기, 나우누리와 하이텔 융합 원칙 | 콘텐츠·명령 참고 |
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
| 이미지 아카이브 | `docs/ref_images`, `docs/google_ref_images`, `docs/종료공지` 등 | 고해상도·중복 정리 자료로 보관. 모든 이미지의 의미·저작권·OCR 검토는 미완료 | 실제 화면 자산으로 채택할 때 개별 검증 |
| 작업 기록 | `docs/WORK_LOG_ARCHIVE.md` | 과거 변경의 근거와 보류 결정을 확인하는 감사 자료 | 기존 결정을 되돌리거나 회귀 원인을 조사할 때 참조 |

## 4. 반영 전 판단 규칙

1. 원전 명령은 현재 라우터와 실제 화면이 존재할 때만 별칭으로 연결한다.
2. 서비스에 없는 기능을 빈 메뉴·빈 게시판으로 만들지 않는다.
3. 키보드 명령 중심의 터미널 흐름을 유지하면서 마우스 접근성을 보완한다.
4. 힌트바·프롬프트·화면 밀도에 관한 사용자 결정을 우선한다.
5. Supabase 스키마·인증·RLS는 코드와 현재 환경을 함께 확인한 뒤 별도 검증한다.
6. 새 반영마다 관련 스모크와 `WORK_LOG.md` 기록을 남긴다.

## 5. 현재 학습 상태 요약

핵심 UI·명령·라우팅 자료는 구현 기준으로 학습되어 있다. 반면 대용량 PDF 원본의 전 페이지 재독, MP4 전체 프레임 분석, 이미지 전체 OCR은 아직 필요할 때 구간별로 수행하는 참고 단계다. 따라서 이후 작업에서는 이 구분을 지키고, 확인하지 않은 자료를 근거로 기능을 추측해 추가하지 않는다.

`docs/PC통신_GO_호환성_카탈로그.md`에 원전 GO 키워드와 현재 서비스 대상의 대조 결과, 그리고 동등 화면이 없어 보류한 키워드를 별도로 기록했다.

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
