# PC통신 GO 명령 호환성 카탈로그

**LOG_ID: 20260828_2205**

이 문서는 `docs/PC통신_명령어_완전_정리.txt`와 현재 `legacy/hanulso.mnu` 메뉴 트리를 대조한 결과다. 원전 키워드를 그대로 복원하는 것이 목적이지만, 현재 서비스에 실제 대상 화면이 없는 명령은 임의의 게시판으로 연결하지 않는다.

## 현재 서비스에서 지원하는 GO 명령

| 원전 명령 | 현재 대상 | 판정 근거 |
| --- | --- | --- |
| `GO TOJUNG` | `/game/tojeong` | 하이텔 `tojung` 별칭과 현재 토정비결 화면이 일치 |
| `GO BIORYM` | `/game/bio` | 하이텔 `biorym` 별칭과 현재 바이오리듬 화면이 일치 |
| `GO GUNGHAP` | `/game/compat` | 하이텔 `gunghap` 별칭과 현재 궁합 화면이 일치 |
| `GO UNSE` | `/game/fortune` | 현재 운세 화면의 한국어 원전 의미와 일치 |
| `GO PUZZLE` | `/game/15p` | 현재 15퍼즐 화면으로 의미가 보존됨 |
| `GO WORD` | `/board/plaza` | 천리안 `word`의 자유/시사 게시판 역할을 현재 PLAZA가 담당 |
| `GO 유머란` | `/board/humor` | 나우누리 우리말 별칭과 현재 HUMOR 게시판이 일치 |
| `GO BLUEHOUSE` | `/guide/tosysop` | 청와대 신문고의 건의/문의 의도를 현재 시삽 건의하기가 담당 |
| `GO MAIL` | `/memo` | 전자우편 최상위 메뉴 |
| `GO ME`, `GO MEMO`, `GO RMAIL` | `/memo/inbox` | 받은 쪽지함 |
| `GO CMAIL` | `/memo/sent` | 보낸 쪽지함 |
| `GO CHATIN` | `/chat` | Nurie historical alias; current chat lobby target |
| `GO CHATTING` | `/chat` | Nurie `HITEL.MNU`의 최상위 `(11) 채팅` 코드와 현재 CHAT 로비가 일치 |
| `GO BLUEHS` | `/guide/tosysop` | Nurie `HITEL.MNU`의 `bluehs`(시삽/건의) 코드와 현재 시삽 건의 화면이 일치 |

### HITEL.MNU·Nurie 샘플 대조 메모

`nurie/HITEL.MNU`와 `nurie15/HITEL.MNU`는 동일한 601개 고유 GO 코드(660개
항목)를 보존한다. 이 수치는 각 줄 끝의 `:[A-Za-z0-9_]+` 토큰만 세어 산출한
것이며, 콜론 뒤 한글 설명/매개변수(`gldown 1` 등)를 포함하는 679/607식 raw
카운트는 GO 코드 수가 아니므로 제외한다. 현재 메뉴 트리에 없는 코드는 임의의 게시판으로 연결하지 않고
보류한다. 두 파일에서 실제 현재 기능과 안전하게 대응되는 추가 후보는
`chatting → CHAT`, `bluehs → TOSYSOP`이며, `rmail/wmail/cmail`은 이미
직접 라우팅 분기가 있어 별칭을 중복 등록하지 않는다. `ANSI1.NRE`~`ANSI4.NRE`는
메뉴 DB가 아니라 화면 샘플이며, `ANSI1.NRE`의 `GO,HI,Z,X` 힌트와 `@[` CSI
전송 표식을 렌더러 smoke에서 검증한다.

## 의도적으로 보류한 명령

아래 키워드는 원전 자료에는 있지만 현재 메뉴 트리에 동등한 서비스가 없다. 임의로 `plaza`, `humor` 또는 다른 게시판에 연결하지 않고, 향후 해당 기능을 실제로 추가할 때만 매핑한다.

`GO PGF`, `GO ANC`, `GO JUBU`, `GO BARUN`, `GO SUMMER`, `GO ELF`, `GO GMF`, `GO VG`, `GO SF`, `GO CHOLCD`

이 보류 목록은 회귀 테스트로 고정되어, 대상 화면이 추가되기 전에는 `GO` 명령이 성공한 것처럼 오인되지 않도록 한다.

## 대화실 내부 동작

대화실은 일반 문장이 메시지로 전송되는 입력 우선순위가 있으므로, `GO 코드`와 `/GO 코드`를 먼저 전역 이동 명령으로 판별한다. 성공한 이동일 때만 현재 방의 퇴장 통지를 보내며, 보류·오타 대상은 방을 유지한 채 안내한다. 이를 통해 원전의 “어느 화면에서든 GO” 의미를 채팅 화면에도 적용한다.

## 검증 방법

- 원전 키워드: `docs/PC통신_명령어_완전_정리.txt`
- 현재 메뉴: `legacy/hanulso.mnu`, `src/server/BoardDefinitionResolver.js`
- 회귀 테스트: `scripts/smoke-go-ansi.js`
- 실행 명령: `npm run smoke:go-ansi`
