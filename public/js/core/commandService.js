/**
 * commandService.js
 * [LOG: 20260428_1725] Massive Purge Re-applied: Only core BBS functions.
 * [LOG: 20260504_1200] Evolution Mode 38: Restoring and expanding scripting & VFS metadata.
 */

export const CMD_META = {
  // Navigation & General
  H: { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  HELP: { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  '?': { label: '도움말', tip: 'H, HELP, ?', priority: 100, cat: 'SYS', desc: '시스템 도움말을 표시합니다.' },
  P: { label: '상위', tip: 'P, M', priority: 95, cat: 'NAV', desc: '상위 메뉴로 이동합니다.' },
  M: { label: '상위', tip: 'P, M', priority: 95, cat: 'NAV', desc: '상위 메뉴로 이동합니다.' },
  T: { label: '초기화면', tip: 'T', priority: 98, cat: 'NAV', desc: 'BBS 초기 화면으로 이동합니다.' },
  GO: { label: '이동', tip: 'GO [코드]', priority: 90, cat: 'NAV', desc: '특정 메뉴나 게시판 코드로 바로 이동합니다.' },
  Z: { label: '이전', tip: 'Z', priority: 85, cat: 'NAV', desc: '이전 화면으로 돌아갑니다.' },
  F: { label: '다음쪽', tip: 'F, [ENTER]', priority: 70, cat: 'NAV', desc: '다음 페이지로 이동합니다. (또는 엔터키)' },
  B: { label: '이전쪽', tip: 'B', priority: 70, cat: 'NAV', desc: '이전 페이지로 이동합니다.' },
  C: { label: '배경색', tip: 'C', priority: 36, cat: 'UI', desc: '터미널 배경색 테마를 전환합니다.' },
  CLS: { label: '화면지움', tip: 'CLS, CLEAR', priority: 10, cat: 'SYS', desc: '터미널 화면을 깨끗이 지웁니다.' },
  CLEAR: { label: '화면지움', tip: 'CLS, CLEAR', priority: 10, cat: 'SYS', desc: '터미널 화면을 깨끗이 지웁니다.' },
  HIST: { label: '작업기록', tip: 'HIST', priority: 10, cat: 'SYS', desc: '최근에 입력한 명령어 기록을 보여줍니다.' },

  // Post Management
  N: { label: '이전글', tip: 'N', priority: 60, cat: 'POST', desc: '목록에서 이전 글을 읽습니다.' },
  A: { label: '다음글', tip: 'A', priority: 60, cat: 'POST', desc: '목록에서 다음 글을 읽습니다.' },
  L: { label: '첫장', tip: 'L', priority: 55, cat: 'POST', desc: '게시판 첫 페이지로 이동하며 검색을 초기화합니다.' },
  W: { label: '글쓰기', tip: 'W', login: true, priority: 50, cat: 'POST', desc: '새 글을 작성합니다.' },
  R: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  RE: { label: '답글', tip: 'R, RE', login: true, priority: 48, cat: 'POST', desc: '현재 글에 대한 답글을 작성합니다.' },
  E: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  ED: { label: '수정', tip: 'E, ED', login: true, priority: 46, cat: 'POST', desc: '내가 작성한 글을 수정합니다.' },
  D: { label: '삭제', tip: 'D, DD', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  DD: { label: '삭제', tip: 'D, DD', login: true, priority: 44, cat: 'POST', desc: '내가 작성한 글을 삭제합니다.' },
  V: { label: '추천', tip: 'V', login: true, priority: 34, cat: 'POST', desc: '현재 글을 추천합니다.' },

  // Search
  LI: { label: 'ID검색', tip: 'LI [아이디]', priority: 80, cat: 'POST', desc: '작성자 아이디로 게시글을 검색합니다.' },
  LT: { label: '제목검색', tip: 'LT [검색어]', priority: 82, cat: 'POST', desc: '제목과 본문을 포함하여 게시글을 검색합니다.' },
  FIND: { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },
  '/': { label: '통합검색', tip: '/, FIND [검색어]', priority: 80, cat: 'POST', desc: '게시판 및 메뉴 통합 검색을 수행합니다.' },

  // Auth & Profile
  LOGIN: { label: '로그인', tip: 'LOGIN', priority: 90, cat: 'AUTH', desc: 'BBS 계정으로 로그인합니다.' },
  PW: { label: '비밀번호', tip: 'PW', priority: 22, cat: 'AUTH', desc: '비밀번호 변경을 수행합니다.' },
  WHO: { label: '회원정보', tip: 'WHO [아이디]', priority: 25, cat: 'AUTH', desc: '특정 사용자의 정보를 확인하거나 접속자 목록을 봅니다.' },
  PF: { label: '프로필', tip: 'PF', priority: 25, cat: 'AUTH', desc: '사용자의 프로필 정보를 확인합니다.' },
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
  ME: { label: '쪽지', tip: 'ME, MEMO', login: true, priority: 30, cat: 'MEMO', desc: '나의 쪽지함을 확인합니다.' },
  MEMO: { label: '쪽지', tip: 'ME, MEMO', login: true, priority: 30, cat: 'MEMO', desc: '나의 쪽지함을 확인합니다.' },
  O: { label: '방만들기', tip: 'O', login: true, priority: 42, cat: 'CHAT', desc: '채팅방을 개설합니다.' },
  PR: { label: '복사', tip: 'PR', priority: 15, cat: 'SYS', desc: '현재 기사 내용을 클립보드에 복사합니다.' },

  // VFS (Virtual File System)
  FILES: { label: '파일목록', tip: 'FILES, DIR', priority: 30, cat: 'VFS', desc: '가상 파일 시스템의 파일 목록을 보여줍니다.' },
  DIR: { label: '파일목록', tip: 'FILES, DIR', priority: 30, cat: 'VFS', desc: '가상 파일 시스템의 파일 목록을 보여줍니다.' },
  CAT: { label: '파일내용', tip: 'CAT [이름]', priority: 28, cat: 'VFS', desc: '파일의 내용을 화면에 출력합니다.' },
  TYPE: { label: '파일내용', tip: 'TYPE [이름]', priority: 28, cat: 'VFS', desc: '파일의 내용을 화면에 출력합니다.' },
  EDIT: { label: '파일편집', tip: 'EDIT [이름]', priority: 25, cat: 'VFS', desc: '내장 에디터로 파일을 생성하거나 수정합니다.' },
  WRITE: { label: '파일저장', tip: 'WRITE [이름] [내용]', priority: 25, cat: 'VFS', desc: '파일에 내용을 즉시 기록합니다.' },
  DEL: { label: '파일삭제', tip: 'DEL [이름]', priority: 20, cat: 'VFS', desc: '파일을 삭제합니다.' },
  INFO: { label: '파일정보', tip: 'INFO [이름]', priority: 15, cat: 'VFS', desc: '파일의 메타데이터를 확인합니다.' },
  CP: { label: '파일복사', tip: 'CP [원본] [대상]', priority: 10, cat: 'VFS', desc: '파일을 다른 이름으로 복사합니다.' },
  MV: { label: '파일이동', tip: 'MV [원본] [대상]', priority: 10, cat: 'VFS', desc: '파일을 이동하거나 이름을 변경합니다.' },
  TOUCH: { label: '시간갱신', tip: 'TOUCH [이름]', priority: 5, cat: 'VFS', desc: '파일의 수정 시간을 현재로 갱신합니다.' },
  WC: { label: '글자세기', tip: 'WC [이름]', priority: 10, cat: 'VFS', desc: '파일의 줄, 단어, 글자 수를 셉니다.' },
  GREP: { label: '문자검색', tip: 'GREP [패턴]', priority: 20, cat: 'VFS', desc: '파일이나 입력에서 특정 패턴을 검색합니다.' },
  SORT: { label: '줄정렬', tip: 'SORT [이름]', priority: 10, cat: 'VFS', desc: '파일 내용을 알파벳 순으로 정렬합니다.' },
  UNIQ: { label: '중복제거', tip: 'UNIQ [이름]', priority: 10, cat: 'VFS', desc: '연속된 중복 줄을 제거합니다.' },
  HEAD: { label: '앞줄보기', tip: 'HEAD [-n] [이름]', priority: 15, cat: 'VFS', desc: '파일의 앞부분 일부를 출력합니다.' },
  TAIL: { label: '뒷줄보기', tip: 'TAIL [-n] [이름]', priority: 15, cat: 'VFS', desc: '파일의 뒷부분 일부를 출력합니다.' },
  DIFF: { label: '내용비교', tip: 'DIFF [파일1] [파일2]', priority: 10, cat: 'VFS', desc: '두 파일의 내용 차이를 비교합니다.' },
  TEE: { label: '입력복사', tip: 'TEE [파일]', priority: 10, cat: 'VFS', desc: '표준 입력을 화면과 파일에 동시에 출력합니다.' },

  // Scripting & Advanced Control
  SET: { label: '변수설정', tip: 'SET [이름] [값]', priority: 10, cat: 'SYS', desc: '환경 변수를 설정합니다.' },
  UNSET: { label: '변수삭제', tip: 'UNSET [이름]', priority: 10, cat: 'SYS', desc: '환경 변수를 제거합니다.' },
  ENV: { label: '환경변수', tip: 'ENV', priority: 10, cat: 'SYS', desc: '현재 설정된 모든 환경 변수를 보여줍니다.' },
  MATH: { label: '산술연산', tip: 'MATH [변수] [수식]', priority: 10, cat: 'SYS', desc: '수식을 계산하여 변수에 저장합니다.' },
  READ: { label: '입력받기', tip: 'READ [변수] [메시지]', priority: 10, cat: 'SYS', desc: '사용자로부터 입력을 받아 변수에 저장합니다.' },
  IF: { label: '조건문', tip: 'IF [조건] [명령]', priority: 10, cat: 'SYS', desc: '조건이 참일 경우 명령을 실행합니다.' },
  WHILE: { label: '반복문', tip: 'WHILE [조건] [명령]', priority: 10, cat: 'SYS', desc: '조건이 참인 동안 명령을 반복합니다.' },
  FOR: { label: '범위반복', tip: 'FOR [변수] [시작] [끝] [명령]', priority: 10, cat: 'SYS', desc: '지정된 범위만큼 명령을 반복합니다.' },
  REPEAT: { label: '단순반복', tip: 'REPEAT [횟수] [명령]', priority: 10, cat: 'SYS', desc: '명령을 지정된 횟수만큼 반복합니다.' },
  FUNC: { label: '함수정의', tip: 'FUNC [이름] ([명령])', priority: 10, cat: 'SYS', desc: '여러 명령을 묶어 함수로 정의합니다.' },
  CALL: { label: '함수호출', tip: 'CALL [이름] [인자]', priority: 10, cat: 'SYS', desc: '정의된 함수를 호출합니다.' },
  SOURCE: { label: '스크립트로드', tip: 'SOURCE [파일]', priority: 10, cat: 'SYS', desc: '외부 스크립트 파일을 현재 컨텍스트에 로드합니다.' },
  RUN: { label: '스크립트실행', tip: 'RUN [파일] [인자]', priority: 10, cat: 'SYS', desc: '스크립트 파일을 새로운 컨텍스트에서 실행합니다.' },
  TRACE: { label: '추적모드', tip: 'TRACE [ON|OFF]', priority: 10, cat: 'SYS', desc: '스크립트 실행 과정을 실시간으로 추적합니다.' },
  TRY: { label: '예외처리', tip: 'TRY (명령) CATCH (명령)', priority: 10, cat: 'SYS', desc: '명령 실행 중 발생하는 오류를 처리합니다.' },
  TRAP: { label: '시그널핸들러', tip: 'TRAP (명령) [SIGNAL]', priority: 10, cat: 'SYS', desc: '특정 시그널 발생 시 실행할 명령을 등록합니다.' },
  WAITPID: { label: '프로세스대기', tip: 'WAITPID [PID]', priority: 10, cat: 'SYS', desc: '백그라운드 프로세스가 종료될 때까지 대기합니다.' },
  JOBS: { label: '작업목록', tip: 'JOBS', priority: 10, cat: 'SYS', desc: '현재 실행 중인 백그라운드 작업 목록을 표시합니다.' },
  KILL: { label: '작업종료', tip: 'KILL [PID]', priority: 10, cat: 'SYS', desc: '백그라운드 작업을 강제로 종료합니다.' },
};

/**
 * Returns commands matching the prefix. Used for autocomplete.
 */
export function getCommandMatches(prefix) {
  if (!prefix) return [];
  const upper = prefix.toUpperCase();
  return Object.keys(CMD_META).filter(cmd => cmd.startsWith(upper));
}

/**
 * Returns the best matching command for the given string.
 */
export function getBestMatch(cmd) {
  if (!cmd) return null;
  const upper = cmd.toUpperCase();
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
