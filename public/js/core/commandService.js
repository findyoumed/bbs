/**
 * commandService.js
 * [LOG: 20260428_1725] Massive Purge Re-applied: Only core BBS functions.
 * [LOG: 20260504_1200] Evolution Mode 38: Restoring and expanding scripting & VFS metadata.
 * [LOG: 20260617_1005] Restore command service factory and priority-ranked matching.
 * [LOG_ID: 20260714_1700] 스크립팅(IF/WHILE/FOR/FUNC/...)·가상파일시스템(FILES/CAT/CP/...)
 * 명령 전부 제거 — 1990년대 PC통신에 없던 기능이고 도움말(HELP_TAB_KEYS)에도 노출되지
 * 않아 실사용자가 쓸 일이 없다는 사용자 판단. SET/UNSET/ENV도 현재 서비스 범위에서
 * 제거되어 CMD_META에 등록하지 않는다.
 */

export const CMD_META = {
  // Navigation & General
  H: { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  HELP: { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  '?': { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  P: { label: '상위', tip: 'P, M', priority: 95, cat: 'NAV', desc: '상위 메뉴로 이동합니다.' },
  M: { label: '상위', tip: 'P, M', priority: 95, cat: 'NAV', desc: '상위 메뉴로 이동합니다.' },
  T: { label: '초기화면', tip: 'T', priority: 98, cat: 'NAV', desc: 'BBS 초기 화면으로 이동합니다.' },
  // [LOG_ID: 20260723_2300] GO는 인자("GO [코드]") 없이는 아무 동작도 하지 않아 힌트바에서
  // 클릭해도 죽은 버튼이었다(사용자 요청: "이동(GO)도 클릭 가능하고 go 텍스트가 선택>> 오른편에
  // 쓰여지면 좋겠어") — prefill:true면 클릭 시 즉시 실행하는 대신 입력줄에 "GO "만 채워 넣고
  // [LOG_ID: 20260730_1754] GO 명령어 priority를 98로 상향하여 힌트바 트림 시 억울하게 가장 먼저 숨겨지는 현상 방지
  GO: { label: '이동', tip: 'GO [코드]', priority: 98, cat: 'NAV', prefill: true, desc: '특정 메뉴나 게시판 코드로 바로 이동합니다.' },
  // [LOG_ID: 20260729_1747] Z (화면 재전송) 명령어 완전 제거
  // [LOG_ID: 20260723_2230] 70(GO=90보다 낮음)이라 실제로 다음 페이지가 있는 화면에서도 좁은
  // 모바일 힌트바 트림(trimHintEntriesToFit)이 GO/T/P보다 F/B를 먼저 숨겼다 — 정작 F/B가 뜬다는
  // 것 자체가 "지금 이 화면에 진짜 다음/이전 페이지가 있다"는 뜻이라 GO(임의 코드 이동, 흔치 않음)
  // 보다 훨씬 더 우선순위가 높아야 한다(사용자 보고: 날씨 지역별 화면 다중 페이지에서 F가 계속
  // 안 보임 — 실측: data-priority=70이 GO=90보다 낮아 트림 1순위로 잘림).
  // [LOG_ID: 20260724_1930] 92는 여전히 P(95)/T(98)보다 낮아, 모바일 폭에서 정확히 한 토큰만
  // 더 잘라내면 되는 경우 P나 T 대신 F/B 쪽이 먼저 잘렸다. 게다가 F/B가 동점(92)일 때
  // trimHintEntriesToFit의 동점 처리(index 큰 쪽 우선 숨김)가 항상 B(다음 목록에 이어 배치돼
  // index가 F보다 큼)만 골라 지워, 페이지 중간(예: 7쪽 중 2쪽)에서 "이전쪽"만 사라지고
  // "다음쪽"은 남는 비대칭 현상이 발생했다(실측: /notice/1 2/7쪽, 모바일 폭 — 힌트바에 F만
  // 남고 B가 통째로 빠짐). 지금 화면에 실제 다음/이전 페이지가 있다는 사실 자체가 P/T/GO보다
  // 훨씬 중요하므로, F/B를 H(100) 바로 아래인 99로 올려 P/T/GO가 먼저 잘리게 한다.
  F: { label: '다음쪽', tip: 'F, [ENTER]', priority: 99, cat: 'NAV', desc: '다음 페이지로 이동합니다. (목록에서 F [번호]는 해당 번호 위치로 이동)' },
  B: { label: '이전쪽', tip: 'B', priority: 99, cat: 'NAV', desc: '이전 페이지로 이동합니다.' },
  C: { label: '배경색', tip: 'C', priority: 36, cat: 'UI', desc: '터미널 배경색 테마를 전환합니다.' },
  COLOR: { label: '배경색', tip: 'COLOR', priority: 35, cat: 'UI', desc: '터미널 배경색 테마를 전환합니다.' },
  CLS: { label: '화면지움', tip: 'CLS, CLEAR', priority: 10, cat: 'SYS', desc: '터미널 화면을 깨끗이 지웁니다.' },
  CLEAR: { label: '화면지움', tip: 'CLS, CLEAR', priority: 10, cat: 'SYS', desc: '터미널 화면을 깨끗이 지웁니다.' },
  HIST: { label: '작업기록', tip: 'HIST', priority: 10, cat: 'SYS', desc: '최근에 입력한 명령어 기록을 보여줍니다.' },

  // Post Management
  // [LOG_ID: 20260722_3400] 하이텔 책(길라잡이 p.92) 실측: A=더 높은 번호(최신 방향, "이전글"),
  // N=더 낮은 번호(과거 방향, "다음글") — 뉴스 기사 보기(commandRouterService.js)와 동일한 방향으로
  // 게시판 글보기(commandRouterPostView.js)도 맞췄다. 라벨도 실제 동작에 맞게 함께 뒤집는다.
  N: { label: '다음글', tip: 'N', priority: 60, cat: 'POST', desc: '목록에서 다음(더 낮은 번호) 글을 읽습니다.' },
  // [LOG_ID: 20260829_1205] A is context-sensitive in the historical guide:
  // post lists use `A 번호` for reply, while post views use bare A for the
  // previous article. Keep one canonical metadata entry but explain both.
  A: { label: '이전글', tip: 'A (목록: A 번호=답글, 글보기: 이전글)', priority: 60, cat: 'POST', desc: '목록에서는 A 번호로 답글을 쓰고, 글 보기에서는 이전 글로 이동합니다.' },
  L: { label: '첫장', tip: 'L', priority: 55, cat: 'POST', desc: '게시판 첫 페이지로 이동하며 검색을 초기화합니다.' },
  // [LOG_ID: 20260804_2037] 하이텔·천리안·나우누리 원전 명령을 현재 단일 UI에 통합:
  // 기존 동작을 중복 구현하지 않고 대표 명령에 원전 별칭을 같이 안내한다.
  W: { label: '글쓰기', tip: 'W, U', login: true, priority: 50, cat: 'POST', desc: '새 글을 작성합니다.' },
  R: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  RE: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  E: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  ED: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  D: { label: '삭제', tip: 'D, DD, DEL', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  DD: { label: '삭제', tip: 'D, DD, DEL', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  V: { label: '추천', tip: 'V, OK', login: true, priority: 34, cat: 'POST', desc: '현재 글을 추천합니다.' },
  OK: { label: '추천', tip: 'V, OK', login: true, priority: 34, cat: 'POST', desc: '현재 글을 추천합니다.' },

  // Search
  LI: { label: 'ID검색', tip: 'LI [아이디], FROM [아이디]', priority: 80, cat: 'POST', desc: '작성자 아이디로 게시글을 검색합니다.' },
  LT: { label: '제목검색', tip: 'LT [검색어]', priority: 82, cat: 'POST', desc: '제목과 본문을 포함하여 게시글을 검색합니다.' },
  // [LOG_ID: 20260729_1750] FIND, / 클릭 시 입력창에 "FIND " 텍스트가 바로 prefill되도록 prefill: true 추가
  FIND: { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', prefill: true, cmdPrefill: 'FIND ', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },
  '/': { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', prefill: true, cmdPrefill: 'FIND ', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },
  // [LOG_ID: 20260721_1800] /help 명령어 감사 — 실제로는 동작하지만 CMD_META에 빠져 있던
  // 명령어들을 보완. 아래부터 이 로그ID로 추가된 항목들은 전부 실제 라우터 코드(commandRouterBrowse.js
  // 등)에서 이미 동작을 확인한 뒤 추가한 것들이다(사용자 지적: "누락된 내용도 확인해야해").
  GA: { label: '본문검색', tip: 'GA [검색어], BODY [검색어]', priority: 78, cat: 'POST', desc: '본문 내용만으로 게시글을 검색합니다.' },
  BODY: { label: '본문검색', tip: 'GA [검색어], BODY [검색어]', priority: 78, cat: 'POST', desc: '본문 내용만으로 게시글을 검색합니다.' },
  NEW: { label: '새글보기', tip: 'NEW, NW', priority: 76, cat: 'POST', desc: '최근 3일 이내에 작성된 게시글만 골라 봅니다.' },
  NW: { label: '새글보기', tip: 'NEW, NW', priority: 76, cat: 'POST', desc: '최근 3일 이내에 작성된 게시글만 골라 봅니다.' },
  LS: { label: '번호이동', tip: 'LS [번호]', priority: 20, cat: 'POST', desc: '글 번호로 목록에서 해당 글이 있는 페이지를 찾아 이동합니다.' },
  LD: { label: '날짜이동', tip: 'LD [월/일], DATE [YYMMDD]', priority: 20, cat: 'POST', desc: '작성 날짜로 목록에서 해당 글이 있는 페이지를 찾아 이동합니다. (예: LD 07/13, DATE 260713)' },
  // [LOG_ID: 20260801_1010] 쪽지함 보관 명령을 K에서 KEEP으로 정립하고 설명 분리
  K: { label: '주제어', tip: 'K [주제어], KEY [주제어]', priority: 18, cat: 'POST', desc: '게시판 목록: 주제어(말머리)로 검색하거나 필터를 해제합니다.' },
  KEEP: { label: '편지보관', tip: 'KEEP [번호]', priority: 18, cat: 'POST', desc: '쪽지함: [번호]로 편지를 보관함에 넣거나 꺼냅니다.' },
  KW: { label: '주제어목록', tip: 'KW', priority: 18, cat: 'POST', desc: '게시판에서 사용된 주제어(말머리) 목록을 모아 봅니다.' },
  // [LOG_ID: 20260721_1800] UL/PUT, DL/TR/GET도 실제로 동일하게 동작하는 별칭이지만(commandRouterBrowse.js),
  // CMD_META 항목을 전부 만들면 /help의 명령 칸(고정 폭)에 별칭이 다 안 들어가 잘려 보인다 —
  // 대표 별칭 2개만 항목으로 두고 나머지는 tip 문구로만 안내한다(기능은 그대로 전부 동작).
  UP: { label: '자료올리기', tip: 'UP, UPLOAD (별칭: UL, PUT / 자료실 전용)', login: true, priority: 20, cat: 'POST', desc: '자료실(PDS)에 새 자료를 올립니다.' },
  UPLOAD: { label: '자료올리기', tip: 'UP, UPLOAD (별칭: UL, PUT / 자료실 전용)', login: true, priority: 20, cat: 'POST', desc: '자료실(PDS)에 새 자료를 올립니다.' },
  // [LOG_ID: 20260722_3300] 하이텔 책(길라잡이 p.128) 실측: "DN 번호1,번호2..."(나열)/
  // "DN 번호1-번호2"(범위) 다중 다운로드도 지원 — 힌트에도 안내해야 발견 가능한 기능이 된다.
  DN: { label: '자료받기', tip: 'DN [번호], DOWNLOAD (별칭: DOWN, DL, TR, GET / 자료실 전용, 예: DN 3,5 또는 DN 1-3)', priority: 20, cat: 'POST', desc: '자료실(PDS)에서 자료를 내려받습니다. 여러 건을 한 번에 받으려면 번호를 쉼표로 나열하거나(DN 3,5) 범위를 지정합니다(DN 1-3).' },
  DOWNLOAD: { label: '자료받기', tip: 'DN [번호], DOWNLOAD (별칭: DOWN, DL, TR, GET / 자료실 전용, 예: DN 3,5 또는 DN 1-3)', priority: 20, cat: 'POST', desc: '자료실(PDS)에서 자료를 내려받습니다. 여러 건을 한 번에 받으려면 번호를 쉼표로 나열하거나(DN 3,5) 범위를 지정합니다(DN 1-3).' },

  // Auth & Profile
  LOGIN: { label: '로그인', tip: 'LOGIN, LOG', priority: 90, cat: 'AUTH', desc: 'BBS 계정으로 로그인합니다.' },
  LOG: { label: '로그인', tip: 'LOGIN, LOG', priority: 90, cat: 'AUTH', desc: 'BBS 계정으로 로그인합니다.' },
  PW: { label: '비밀번호', tip: 'PW', priority: 22, cat: 'AUTH', desc: '내 정보 화면에서 비밀번호 변경을 시작합니다. (HI로 먼저 내 정보 화면에 들어가야 합니다)' },
  WHO: { label: '회원정보', tip: 'WHO [아이디], U', priority: 25, cat: 'AUTH', desc: '특정 사용자의 정보를 확인하거나 WHO/U로 접속자 목록을 봅니다.' },
  // [LOG_ID: 20260714_2100] 원전 UID(총 접속 ID 조회)/MSG(쪽지 수신 알림 ON·OFF) 명령 추가
  UID: { label: '접속자ID', tip: 'UID', priority: 24, cat: 'AUTH', desc: '현재 접속 중인 전체 이용자 ID 목록을 봅니다.' },
  MSG: { label: '쪽지알림', tip: 'MSG, MSG ON/OFF, MSG R', priority: 24, cat: 'AUTH', desc: '접속 시 새 쪽지 도착 알림을 켜거나 끕니다. MSG R로 받은쪽지함을 바로 확인합니다.' },
  // [LOG_ID: 20260719_2200] 나우누리 원전 대화실 /BUDDY(접속 알림) 재현 — UID/WHO 접속자 목록에서 강조 표시
  BUDDY: { label: '버디목록', tip: 'BUDDY [id], BUDDY DEL [id]', priority: 24, cat: 'AUTH', desc: '관심 있는 사용자를 버디로 등록합니다. UID/WHO 접속자 목록에서 ★로 강조됩니다.' },
  PF: { label: '프로필', tip: 'PF, PF [아이디]', priority: 25, cat: 'AUTH', desc: 'PF [아이디]는 해당 사용자의 프로필을 봅니다. 아이디 없이 PF만 입력하면 HI/MYINFO와 동일한 내 정보 화면이 열립니다.' },
  // [LOG_ID: 20260731_1930] BYID/BYNAME은 CMD_META에 없어 GO/FIND처럼 prefill되지 않고
  // data-cmd(즉시 실행)로 렌더링됐다 — 클릭하면 인자 없는 "BYID"가 그대로 실행되어
  // commandRouterService.js의 `/^BYID\s+(.+)$/i` 매치에 실패하고 `findMember('BYID', 'any')`로
  // 떨어져 "byid"라는 이름의 회원을 찾으려 시도했다(사용자 보고: 클릭해도 입력이 유지 안 됨).
  // GO/FIND와 동일하게 prefill:true를 줘서 클릭 시 입력줄에 "BYID "/"BYNAME "만 채운다.
  BYID: { label: '아이디로', tip: 'BYID <아이디>', priority: 25, cat: 'AUTH', prefill: true, desc: '아이디로 회원을 찾습니다. (이용자검색 화면 전용)' },
  BYNAME: { label: '이름으로', tip: 'BYNAME <이름>', priority: 25, cat: 'AUTH', prefill: true, desc: '이름(닉네임)으로 회원을 찾습니다. (이용자검색 화면 전용)' },
  HI: { label: '내정보', tip: 'HI, MYINFO', priority: 20, cat: 'AUTH', desc: '나의 회원 정보를 확인하거나 수정합니다.' },
  MYINFO: { label: '내정보', tip: 'HI, MYINFO', priority: 20, cat: 'AUTH', desc: '나의 회원 정보를 확인하거나 수정합니다.' },
  // [LOG_ID: 20260729_1710] 당연한 입력 보조 명령어(ENTER, CHANGE, SEND, S, SAVE) 도움말 목록에서 삭제
  DELETE: { label: '탈퇴', tip: 'DELETE', priority: 42, cat: 'AUTH', desc: '내 정보 화면에서 회원 탈퇴 절차를 시작합니다.' },
  Q: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  X: { label: '종료', tip: 'Q, EXIT, X', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  EXIT: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  BYE: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  LOGOUT: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },

  // Messaging & Chat
  // [LOG_ID: 20260829_1450] MAIL/RMAIL/CMAIL은 같은 전자우편 계열이지만
  // 라우팅 대상이 다르다. ME/MEMO/RMAIL은 받은편지함, MAIL은 전자우편
  // 메뉴, CMAIL은 보낸편지함으로 안내해 실제 동작과 도움말을 일치시킨다.
  ME: { label: '쪽지', tip: 'ME, MEMO, RMAIL (받은편지함)', login: true, priority: 30, cat: 'MEMO', desc: '받은편지함을 확인합니다.' },
  MEMO: { label: '쪽지', tip: 'ME, MEMO, RMAIL (받은편지함)', login: true, priority: 30, cat: 'MEMO', desc: '받은편지함을 확인합니다.' },
  WMAIL: { label: '쪽지쓰기', tip: 'WMAIL', login: true, priority: 30, cat: 'MEMO', desc: '새 쪽지 쓰기 화면을 바로 엽니다.' },
  TO: { label: '한줄쪽지', tip: 'TO [아이디] [한줄메시지]', login: true, priority: 31, cat: 'MEMO', prefill: true, desc: '별도의 쓰기 화면 없이 상대에게 한 줄 쪽지를 바로 보냅니다.' },
  SOS: { label: '시삽 긴급연락', tip: 'SOS [메시지]', login: true, priority: 31, cat: 'MEMO', prefill: true, cmdPrefill: 'SOS ', desc: '시삽에게 긴급 건의를 작성하고 전송 전 확인합니다.' },
  FW: { label: '쪽지전달', tip: 'FW [번호] [아이디] (목록), FW (읽기)', login: true, priority: 18, cat: 'MEMO', desc: '목록에서는 지정 쪽지를 입력한 사용자에게 전달하고, 읽기 화면에서는 현재 쪽지를 전달합니다.' },
  WC: { label: '카드쓰기', tip: 'WC (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지함에서 축하카드/그림엽서 쓰기를 시작합니다.' },
  ABSENT: { label: '부재중', tip: 'ABSENT, 부재 (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지함에서 부재기간(시작일/종료일)과 사유를 등록합니다. 이미 등록돼 있으면 해제 여부를 묻습니다.' },
  MB: { label: '보관함', tip: 'MB (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지 편지보관함을 엽니다. K [번호]로 보관하거나 꺼낼 수 있습니다.' },
  GRP: { label: '주소록', tip: 'GRP, GRP+ 이름 아이디1,아이디2, GRP- 이름 (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '단체편지용 주소록 그룹을 관리합니다. GRP는 목록, GRP+는 등록, GRP-는 삭제입니다.' },
  // [LOG_ID: 20260713_1230] 나우누리 CMAIL '배달 확인/취소' 재현 — 보낸쪽지함 발송 취소
  CM: { label: '발송취소', tip: 'CM [번호]', login: true, priority: 32, cat: 'MEMO', desc: '보낸쪽지함에서 상대가 아직 읽지 않은 쪽지의 발송을 취소합니다.' },
  // [LOG_ID: 20260730_1719] CHAT (대화실) 명령어 메타데이터 추가
  // [LOG_ID: 20260829_1345] Nownuri CHATIN is a provider-specific spelling
  // for the same chat-lobby destination; normalization keeps one runtime path.
  CHAT: { label: '대화실', tip: 'CHAT, CHATIN, 대화', login: true, priority: 50, cat: 'CHAT', desc: '대화실(채팅) 로비로 바로 이동합니다.' },
  O: { label: '방만들기', tip: 'O', login: true, priority: 42, cat: 'CHAT', desc: '채팅방을 개설합니다.' },
  J: { label: '방입장', tip: 'J [방번호], JOIN [방번호]', login: true, priority: 40, cat: 'CHAT', desc: '대화실 로비에서 방 번호로 채팅방에 입장합니다.' },
  JOIN: { label: '방입장', tip: 'J [방번호], JOIN [방번호]', login: true, priority: 40, cat: 'CHAT', desc: '대화실 로비에서 방 번호로 채팅방에 입장합니다.' },
  ST: { label: '대화상태', tip: 'ST, /ST', login: true, priority: 20, cat: 'CHAT', desc: '현재 대화방의 참여자 상태를 확인합니다.' },
  FI: { label: '접속자찾기', tip: 'FI [아이디], /FI [아이디]', login: true, priority: 20, cat: 'CHAT', prefill: true, desc: '특정 사용자의 접속 위치나 프로필을 찾습니다.' },
  // [LOG_ID: 20260712_0030] 라벨을 '연속읽기'로 통일(사용자 결정). 뉴스의 클립보드 복사 동작은 desc에만 남긴다.
  PR: { label: '연속읽기', tip: 'PR [번호/범위], MR [번호/범위]', priority: 15, cat: 'SYS', desc: '게시판: 해당 번호부터 엔터로 글을 이어서 읽습니다. 뉴스: 본문 전체를 한 화면에 펼치고 클립보드에 복사합니다.' },
  PT: { label: '제목일괄보기', tip: 'PT [시작번호]', priority: 15, cat: 'POST', desc: '지정한 번호부터 게시글 제목을 연속으로 모아 봅니다.' },
  USER: { label: '접속자', tip: 'USER, USER ALL', priority: 24, cat: 'AUTH', desc: '현재 접속한 이용자와 접속 위치를 확인합니다.' },
  ANSI: { label: 'ANSI제어', tip: 'ANSI, ANSI ON/OFF', priority: 14, cat: 'UI', desc: 'ANSI 화면 제어 표현을 켜거나 끕니다.' },
  // [LOG_ID: 20260721_1800] 하이텔 원전 이용시간(TIME) 확인 명령 — 실제로는 이미 배선돼
  // 있었으나 도움말에 없었다.
  TIME: { label: '이용시간', tip: 'TIME, USE', priority: 15, cat: 'SYS', desc: '현재 시각과 이번 접속의 누적 이용 시간을 확인합니다.' },

  // [LOG_ID: 20260729_1708] 사용자 요청으로 SET, UNSET, ENV 명령어 제거
};

// Screen-local actions are intentionally kept out of CMD_META so they do not
// appear in global help/autocomplete. They still need metadata when a footer
// renders them as keyboard- and mouse-accessible tokens.
const contextMeta = (meta) => ({ ...meta, contextOnly: true });
export const CONTEXT_CMD_META = Object.freeze({
  I: contextMeta({ label: '받은편지', tip: 'I (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '받은편지함으로 이동합니다.' }),
  S: contextMeta({ label: '보낸편지', tip: 'S (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '보낸편지함으로 이동합니다.' }),
  SEND: contextMeta({ label: '전송', tip: 'SEND, Ctrl+S', login: true, priority: 32, cat: 'MEMO', desc: '현재 입력 내용을 전송합니다.' }),
  CHANGE: contextMeta({ label: '변경', tip: 'CHANGE, Enter', login: true, priority: 32, cat: 'AUTH', desc: '현재 입력 내용을 저장하고 변경합니다.' }),
  ENTER: contextMeta({ label: '확인', tip: 'ENTER', login: true, priority: 32, cat: 'SYS', desc: '현재 입력을 확인하고 다음 단계로 이동합니다.' }),
  CP: contextMeta({ label: '복사', tip: 'CP', priority: 20, cat: 'SYS', desc: '현재 시스템 로그를 복사합니다.' }),
  0: contextMeta({ label: '게임끝내기', tip: '0', priority: 1, cat: 'GAME', desc: '현재 행맨 게임을 포기하고 나갑니다.' }),
  '/L': contextMeta({ label: '목록', tip: '/L', login: true, priority: 20, cat: 'CHAT', desc: '대화방 목록으로 돌아갑니다.' }),
  '/W': contextMeta({ label: '참여자', tip: '/W', login: true, priority: 20, cat: 'CHAT', desc: '현재 대화방 참여자를 확인합니다.' }),
  '/Z': contextMeta({ label: '다시보기', tip: '/Z [N]', login: true, priority: 20, cat: 'CHAT', desc: '현재 대화방의 지난 메시지를 다시 봅니다.' })
});

export function getCommandMeta(cmd) {
  const normalized = String(cmd || '').trim().toUpperCase();
  return CMD_META[normalized] || CONTEXT_CMD_META[normalized] || null;
}

// [LOG_ID: 20260805_1054] 명령 메타데이터는 초기화 후 변경되지 않으므로 같은 접두어의
// 자동완성 결과를 매 입력 이벤트마다 다시 필터·정렬하지 않도록 제한된 캐시를 사용한다.
const commandMatchCache = new Map();
const COMMAND_MATCH_CACHE_LIMIT = 64;

/**
 * Returns commands matching the prefix. Used for autocomplete.
 */
export function getCommandMatches(prefix) {
  const upper = String(prefix || '').trim().toUpperCase();
  if (!upper) return [];

  if (commandMatchCache.has(upper)) {
    return commandMatchCache.get(upper).slice();
  }

  const matches = Object.keys(CMD_META)
    .filter(cmd => cmd.startsWith(upper))
    .sort((left, right) => {
      const leftExact = left === upper ? 1 : 0;
      const rightExact = right === upper ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;

      const leftPriority = Number(CMD_META[left]?.priority || 0);
      const rightPriority = Number(CMD_META[right]?.priority || 0);
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;

      if (left.length !== right.length) return left.length - right.length;
      return left.localeCompare(right);
    });

  if (commandMatchCache.size >= COMMAND_MATCH_CACHE_LIMIT) {
    commandMatchCache.delete(commandMatchCache.keys().next().value);
  }
  commandMatchCache.set(upper, matches);
  return matches.slice();
}

/**
 * Returns the best matching command for the given string.
 */
export function getBestMatch(cmd) {
  const upper = String(cmd || '').trim().toUpperCase();
  if (!upper) return null;
  if (CMD_META[upper]) return upper;

  const matches = getCommandMatches(upper);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Returns the description of a command.
 */
export function getCommandDesc(cmd) {
  const upper = String(cmd || '').toUpperCase();
  return CMD_META[upper]?.desc || CMD_META[upper]?.label || '';
}

/**
 * Validates if the command exists in the metadata.
 */
export function isValidCommand(cmd) {
  return !!CMD_META[String(cmd || '').toUpperCase()];
}

export function createCommandService(deps = {}) {
  const state = deps.state || {};

  function isCommandAvailable(cmd) {
    const meta = CMD_META[String(cmd || '').trim().toUpperCase()];
    if (!meta) return false;
    if (!meta.login) return true;
    return !!state.user && state.user.isGuest === false;
  }

  return {
    CMD_META,
    CONTEXT_CMD_META,
    getCommandMatches,
    getBestMatch,
    getCommandDesc,
    getCommandMeta,
    isValidCommand,
    isCommandAvailable
  };
}
