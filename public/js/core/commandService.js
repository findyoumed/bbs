/**
 * commandService.js
 * [LOG: 20260428_1725] Massive Purge Re-applied: Only core BBS functions.
 * [LOG: 20260504_1200] Evolution Mode 38: Restoring and expanding scripting & VFS metadata.
 * [LOG: 20260617_1005] Restore command service factory and priority-ranked matching.
 * [LOG_ID: 20260714_1700] 스크립팅(IF/WHILE/FOR/FUNC/...)·가상파일시스템(FILES/CAT/CP/...)
 * 명령 전부 제거 — 1990년대 PC통신에 없던 기능이고 도움말(HELP_TAB_KEYS)에도 노출되지
 * 않아 실사용자가 쓸 일이 없다는 사용자 판단. SET/UNSET/ENV는 SET LEVEL/HOME/THEME/
 * PROMPT 같은 실제 사이트 기능의 기반이라 유지.
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
  // 커서를 포커스해, 사용자가 이어서 코드를 타이핑할 수 있게 한다.
  GO: { label: '이동', tip: 'GO [코드]', priority: 90, cat: 'NAV', prefill: true, desc: '특정 메뉴나 게시판 코드로 바로 이동합니다.' },
  // [LOG_ID: 20260712_2130] 하이텔 원전 의미(화면 재전송)로 변경 — 사용자 결정 (hitel_upgrade_plan P4-1)
  Z: { label: '재전송', tip: 'Z', priority: 85, cat: 'NAV', desc: '현재 화면을 다시 그립니다. (하이텔: 잡음으로 깨진 화면 재전송)' },
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
  F: { label: '다음쪽', tip: 'F, [ENTER]', priority: 99, cat: 'NAV', desc: '다음 페이지로 이동합니다. (또는 엔터키)' },
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
  A: { label: '이전글', tip: 'A', priority: 60, cat: 'POST', desc: '목록에서 이전(더 높은 번호) 글을 읽습니다.' },
  L: { label: '첫장', tip: 'L', priority: 55, cat: 'POST', desc: '게시판 첫 페이지로 이동하며 검색을 초기화합니다.' },
  W: { label: '글쓰기', tip: 'W', login: true, priority: 50, cat: 'POST', desc: '새 글을 작성합니다.' },
  R: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  RE: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  E: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  ED: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  D: { label: '삭제', tip: 'D, DD', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  DD: { label: '삭제', tip: 'D, DD', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  V: { label: '추천', tip: 'V, OK', login: true, priority: 34, cat: 'POST', desc: '현재 글을 추천합니다.' },
  OK: { label: '추천', tip: 'V, OK', login: true, priority: 34, cat: 'POST', desc: '현재 글을 추천합니다.' },

  // Search
  LI: { label: 'ID검색', tip: 'LI [아이디]', priority: 80, cat: 'POST', desc: '작성자 아이디로 게시글을 검색합니다.' },
  LV: { label: '등급변경', tip: 'LV [등급]', login: true, priority: 5, cat: 'POST', desc: '(운영자) 게시글 작성자의 회원 등급을 변경합니다. 게시글 보기 화면에서 사용. (1:일반회원, 2:특별회원, 99:운영자)' },
  LT: { label: '제목검색', tip: 'LT [검색어]', priority: 82, cat: 'POST', desc: '제목과 본문을 포함하여 게시글을 검색합니다.' },
  FIND: { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },
  '/': { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },
  // [LOG_ID: 20260721_1800] /help 명령어 감사 — 실제로는 동작하지만 CMD_META에 빠져 있던
  // 명령어들을 보완. 아래부터 이 로그ID로 추가된 항목들은 전부 실제 라우터 코드(commandRouterBrowse.js
  // 등)에서 이미 동작을 확인한 뒤 추가한 것들이다(사용자 지적: "누락된 내용도 확인해야해").
  GA: { label: '본문검색', tip: 'GA [검색어], BODY [검색어]', priority: 78, cat: 'POST', desc: '본문 내용만으로 게시글을 검색합니다.' },
  BODY: { label: '본문검색', tip: 'GA [검색어], BODY [검색어]', priority: 78, cat: 'POST', desc: '본문 내용만으로 게시글을 검색합니다.' },
  NEW: { label: '새글보기', tip: 'NEW, NW', priority: 76, cat: 'POST', desc: '최근 3일 이내에 작성된 게시글만 골라 봅니다.' },
  NW: { label: '새글보기', tip: 'NEW, NW', priority: 76, cat: 'POST', desc: '최근 3일 이내에 작성된 게시글만 골라 봅니다.' },
  LS: { label: '번호이동', tip: 'LS [번호]', priority: 20, cat: 'POST', desc: '글 번호로 목록에서 해당 글이 있는 페이지를 찾아 이동합니다.' },
  LD: { label: '날짜이동', tip: 'LD [월/일]', priority: 20, cat: 'POST', desc: '작성 날짜(월/일)로 목록에서 해당 글이 있는 페이지를 찾아 이동합니다. (예: LD 07/13)' },
  K: { label: '주제어', tip: 'K, K [번호]', priority: 18, cat: 'POST', desc: '게시판 목록: 주제어(말머리) 필터를 해제합니다. 쪽지함: K [번호]로 편지를 보관함에 넣거나 꺼냅니다.' },
  KW: { label: '주제어목록', tip: 'KW', priority: 18, cat: 'POST', desc: '게시판에서 사용된 주제어(말머리) 목록을 모아 봅니다.' },
  // [LOG_ID: 20260721_1800] UL/PUT, DL/TR/GET도 실제로 동일하게 동작하는 별칭이지만(commandRouterBrowse.js),
  // CMD_META 항목을 전부 만들면 /help의 명령 칸(고정 폭)에 별칭이 다 안 들어가 잘려 보인다 —
  // 대표 별칭 2개만 항목으로 두고 나머지는 tip 문구로만 안내한다(기능은 그대로 전부 동작).
  UP: { label: '자료올리기', tip: 'UP, UPLOAD (별칭: UL, PUT / 자료실 전용)', login: true, priority: 20, cat: 'POST', desc: '자료실(PDS)에 새 자료를 올립니다.' },
  UPLOAD: { label: '자료올리기', tip: 'UP, UPLOAD (별칭: UL, PUT / 자료실 전용)', login: true, priority: 20, cat: 'POST', desc: '자료실(PDS)에 새 자료를 올립니다.' },
  // [LOG_ID: 20260722_3300] 하이텔 책(길라잡이 p.128) 실측: "DN 번호1,번호2..."(나열)/
  // "DN 번호1-번호2"(범위) 다중 다운로드도 지원 — 힌트에도 안내해야 발견 가능한 기능이 된다.
  DN: { label: '자료받기', tip: 'DN [번호], DOWNLOAD (별칭: DL, TR, GET / 자료실 전용, 예: DN 3,5 또는 DN 1-3)', priority: 20, cat: 'POST', desc: '자료실(PDS)에서 자료를 내려받습니다. 여러 건을 한 번에 받으려면 번호를 쉼표로 나열하거나(DN 3,5) 범위를 지정합니다(DN 1-3).' },
  DOWNLOAD: { label: '자료받기', tip: 'DN [번호], DOWNLOAD (별칭: DL, TR, GET / 자료실 전용, 예: DN 3,5 또는 DN 1-3)', priority: 20, cat: 'POST', desc: '자료실(PDS)에서 자료를 내려받습니다. 여러 건을 한 번에 받으려면 번호를 쉼표로 나열하거나(DN 3,5) 범위를 지정합니다(DN 1-3).' },

  // Auth & Profile
  LOGIN: { label: '로그인', tip: 'LOGIN', priority: 90, cat: 'AUTH', desc: 'BBS 계정으로 로그인합니다.' },
  PW: { label: '비밀번호', tip: 'PW', priority: 22, cat: 'AUTH', desc: '내 정보 화면에서 비밀번호 변경을 시작합니다. (HI로 먼저 내 정보 화면에 들어가야 합니다)' },
  WHO: { label: '회원정보', tip: 'WHO [아이디]', priority: 25, cat: 'AUTH', desc: '특정 사용자의 정보를 확인하거나 접속자 목록을 봅니다.' },
  // [LOG_ID: 20260714_2100] 원전 UID(총 접속 ID 조회)/MSG(쪽지 수신 알림 ON·OFF) 명령 추가
  UID: { label: '접속자ID', tip: 'UID', priority: 24, cat: 'AUTH', desc: '현재 접속 중인 전체 이용자 ID 목록을 봅니다.' },
  MSG: { label: '쪽지알림', tip: 'MSG, MSG ON/OFF, MSG R', priority: 24, cat: 'AUTH', desc: '접속 시 새 쪽지 도착 알림을 켜거나 끕니다. MSG R로 받은쪽지함을 바로 확인합니다.' },
  // [LOG_ID: 20260719_2200] 나우누리 원전 대화실 /BUDDY(접속 알림) 재현 — UID/WHO 접속자 목록에서 강조 표시
  BUDDY: { label: '버디목록', tip: 'BUDDY [id], BUDDY DEL [id]', priority: 24, cat: 'AUTH', desc: '관심 있는 사용자를 버디로 등록합니다. UID/WHO 접속자 목록에서 ★로 강조됩니다.' },
  PF: { label: '프로필', tip: 'PF, PF [아이디]', priority: 25, cat: 'AUTH', desc: 'PF [아이디]는 해당 사용자의 프로필을 봅니다. 아이디 없이 PF만 입력하면 HI/MYINFO와 동일한 내 정보 화면이 열립니다.' },
  HI: { label: '내정보', tip: 'HI, MYINFO', priority: 20, cat: 'AUTH', desc: '나의 회원 정보를 확인하거나 수정합니다.' },
  MYINFO: { label: '내정보', tip: 'HI, MYINFO', priority: 20, cat: 'AUTH', desc: '나의 회원 정보를 확인하거나 수정합니다.' },
  ENTER: { label: '변경', tip: 'ENTER', priority: 62, cat: 'UI', desc: '현재 입력 화면의 기본 작업을 실행합니다.' },
  CHANGE: { label: '변경', tip: 'CHANGE', priority: 62, cat: 'UI', desc: '입력한 새 값으로 변경 작업을 진행합니다.' },
  SEND: { label: '전송', tip: 'SEND', priority: 62, cat: 'UI', desc: '현재 입력한 내용을 전송합니다.' },
  S: { label: '저장', tip: 'S, SAVE', priority: 62, cat: 'UI', desc: '작성 중인 내용을 저장합니다.' },
  SAVE: { label: '저장', tip: 'S, SAVE', priority: 62, cat: 'UI', desc: '작성 중인 내용을 저장합니다.' },
  DELETE: { label: '탈퇴', tip: 'DELETE', priority: 42, cat: 'AUTH', desc: '내 정보 화면에서 회원 탈퇴 절차를 시작합니다.' },
  Q: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  X: { label: '종료', tip: 'Q, EXIT, X', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  EXIT: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  BYE: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },
  LOGOUT: { label: '종료', tip: 'Q, EXIT', priority: 1, cat: 'NAV', desc: '로그아웃하고 메인 화면으로 이동합니다.' },

  // Messaging & Chat
  // [LOG_ID: 20260721_1800] MAIL/RMAIL/CMAIL도 원전(NOW_MENU.DAT) "11.전자우편" 메뉴의 진입
  // 명령들로 실제 전부 같은 쪽지함 화면을 열지만(commandRouterGlobalNavigation.js), CMD_META
  // 항목을 다 만들면 /help의 명령 칸(고정 폭)에서 잘려 보인다 — ME/MEMO만 항목으로 두고
  // 나머지는 tip 문구로 안내한다(기능은 그대로 전부 동작). CMAIL이라는 이름 때문에 아래
  // CM(발송취소)과 헷갈리기 쉬운데, 실제로 CMAIL은 CM과 무관하게 쪽지함을 그냥 연다.
  ME: { label: '쪽지', tip: 'ME, MEMO (별칭: MAIL, RMAIL, CMAIL)', login: true, priority: 30, cat: 'MEMO', desc: '나의 쪽지함을 확인합니다.' },
  MEMO: { label: '쪽지', tip: 'ME, MEMO (별칭: MAIL, RMAIL, CMAIL)', login: true, priority: 30, cat: 'MEMO', desc: '나의 쪽지함을 확인합니다.' },
  WMAIL: { label: '쪽지쓰기', tip: 'WMAIL', login: true, priority: 30, cat: 'MEMO', desc: '새 쪽지 쓰기 화면을 바로 엽니다.' },
  WC: { label: '카드쓰기', tip: 'WC (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지함에서 축하카드/그림엽서 쓰기를 시작합니다.' },
  ABSENT: { label: '부재중', tip: 'ABSENT, 부재 (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지함에서 부재기간(시작일/종료일)과 사유를 등록합니다. 이미 등록돼 있으면 해제 여부를 묻습니다.' },
  MB: { label: '보관함', tip: 'MB (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '쪽지 편지보관함을 엽니다. K [번호]로 보관하거나 꺼낼 수 있습니다.' },
  GRP: { label: '주소록', tip: 'GRP, GRP+ 이름 아이디1,아이디2, GRP- 이름 (쪽지함 전용)', login: true, priority: 18, cat: 'MEMO', desc: '단체편지용 주소록 그룹을 관리합니다. GRP는 목록, GRP+는 등록, GRP-는 삭제입니다.' },
  // [LOG_ID: 20260713_1230] 나우누리 CMAIL '배달 확인/취소' 재현 — 보낸쪽지함 발송 취소
  CM: { label: '발송취소', tip: 'CM [번호]', login: true, priority: 32, cat: 'MEMO', desc: '보낸쪽지함에서 상대가 아직 읽지 않은 쪽지의 발송을 취소합니다.' },
  O: { label: '방만들기', tip: 'O', login: true, priority: 42, cat: 'CHAT', desc: '채팅방을 개설합니다.' },
  J: { label: '방입장', tip: 'J [방번호], JOIN [방번호]', login: true, priority: 40, cat: 'CHAT', desc: '대화실 로비에서 방 번호로 채팅방에 입장합니다.' },
  JOIN: { label: '방입장', tip: 'J [방번호], JOIN [방번호]', login: true, priority: 40, cat: 'CHAT', desc: '대화실 로비에서 방 번호로 채팅방에 입장합니다.' },
  // [LOG_ID: 20260712_0030] 라벨을 '연속읽기'로 통일(사용자 결정). 뉴스의 클립보드 복사 동작은 desc에만 남긴다.
  PR: { label: '연속읽기', tip: 'PR [번호]', priority: 15, cat: 'SYS', desc: '게시판: 해당 번호부터 엔터로 글을 이어서 읽습니다. 뉴스: 본문 전체를 한 화면에 펼치고 클립보드에 복사합니다.' },
  // [LOG_ID: 20260721_1800] 하이텔 원전 이용시간(TIME) 확인 명령 — 실제로는 이미 배선돼
  // 있었으나 도움말에 없었다.
  TIME: { label: '이용시간', tip: 'TIME', priority: 15, cat: 'SYS', desc: '현재 시각과 이번 접속의 누적 이용 시간을 확인합니다.' },

  // Environment & Preferences (SET LEVEL/HOME/THEME/PROMPT의 기반)
  SET: { label: '변수설정', tip: 'SET [이름] [값]', priority: 10, cat: 'SYS', desc: '환경 변수를 설정합니다. (예: SET LEVEL 초급, SET HOME 게시판, SET THEME NOWNURI)' },
  UNSET: { label: '변수삭제', tip: 'UNSET [이름]', priority: 10, cat: 'SYS', desc: '환경 변수를 제거합니다.' },
  ENV: { label: '환경변수', tip: 'ENV', priority: 10, cat: 'SYS', desc: '현재 설정된 모든 환경 변수를 보여줍니다.' },
  // [LOG_ID: 20260713_1000] 갈무리(CAP) 기능 메타데이터 추가
  CAP: { label: '갈무리', tip: 'CAP, 갈무리', priority: 15, cat: 'SYS', desc: '화면 갈무리를 시작하거나 종료합니다.' },
};

/**
 * Returns commands matching the prefix. Used for autocomplete.
 */
export function getCommandMatches(prefix) {
  const upper = String(prefix || '').trim().toUpperCase();
  if (!upper) return [];

  return Object.keys(CMD_META)
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
    getCommandMatches,
    getBestMatch,
    getCommandDesc,
    isValidCommand,
    isCommandAvailable
  };
}
