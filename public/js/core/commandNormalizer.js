import { CMD_META, getBestMatch } from './commandService.js';

/**
 * [LOG: 20260425_2355] 입력 명령어 정규화 고도화
 * - 한글 오타 보정 및 특수문자 치환
 * - 존재하지 않는 명령어일 경우 부분 일치(Prefix Match) 보정 추가
 */
export function normalizeCommand(rawCmd, stateScreen) {
  // [LOG: 20260428_1730] Auto-Next Page: Map empty input (Enter key) to "F" for paged screens.
  // [LOG_ID: 20260715_2100] 'policy'(GUIDE의 이용약관/개인정보처리방침) 화면이 빠져있어 그
  // 화면에서만 빈 엔터가 F로 정규화되지 않았다 — help/post-list 등과 똑같이 F 페이징을 쓰는
  // 화면인데 목록에서 누락됐던 것(사용자 보고: guide 하위 메뉴에서 엔터로 다음쪽 이동 안 됨).
  if (!rawCmd || String(rawCmd).trim() === '') {
    const pagedScreens = ['help', 'policy', 'post-list', 'board-select', 'news-list', 'memo-list', 'memos-list', 'weather-view', 'news-view'];
    if (pagedScreens.includes(stateScreen)) {
      return 'F';
    }
    return '';
  }

  let cmdString = String(rawCmd).trim();
  let [cmdHead, ...args] = cmdString.split(/\s+/);
  let cmd = cmdHead.toUpperCase();

  const koAliasMap = {
    'ㅔ': 'P', 'ㅡ': 'M', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅁ': 'A', 'ㄹ': 'F',
    'ㅣ': 'L', 'ㅅ': 'T', 'ㅈ': 'W', 'ㄱ': 'R', 'ㄷ': 'E', 'ㅇ': 'D',
    'ㄴ': 'S', 'ㅍ': 'V', 'ㅊ': 'C', 'ㅐ': 'O', 'ㅗ': 'H', 'ㅂ': 'Q',
    'ㅌ': 'X', 'ㅛ': 'Y',
    '햎': 'GO', '구꽬': 'RE', '두깋': 'ED', '뉸깋': 'DD', 'ㅌㅊㅣ': 'LT', 'ㅌㅊㅐ': 'LI',
    'ㅣㅅ': 'LT', 'ㅣㅑ': 'LI', 'ㅕㄴㄷㄱ': 'USER', 'ㅎ디ㅔ': 'HELP',
    'ㅡㄷ': 'ME', 'ㅡ드': 'ME', 'ㅠㅠㄴ': 'BBS', '쳐': 'CHAT',
    '갈무리': 'CAP', '캡': 'CAP',
    '/ㅁ': '/Q', '/균ㅆ': '/QUIT', 'ㅐ': 'O',
    
    // [LOG_ID: 20260718_1930] 명령어 한국어 매핑표 재현
    '상위': 'P', '앞': 'B', '이전글': 'N', '다음글': 'A', '다음': 'F',
    '목록': 'L', '초기화면': 'T', '이동': 'GO', '쓰기': 'W', '댓글': 'RE',
    '수정': 'E', '삭제': 'D', '추천': 'V', '로그인': 'L', '배경색': 'C',
    '만들기': 'O', '복사': 'PR', '도움말': 'H', '제목검색': 'LT',
    '작성자검색': 'LI', '사용자': 'PF', '쪽지': 'ME',
    '/종료': '/Q', '/쪽지': '/ME', '/대화방': '/ST', '/다시보기': '/Z',
    '/차단': '/EX', '/내보내기': '/OUT', '/신고': '/JUDGE'
  };

  // 1. 단일 키워드 정규화
  if (koAliasMap[cmd]) {
    cmd = koAliasMap[cmd];
  } else {
    // [LOG_ID: 20260710_1203] 모든 영문 명령어가 한글 오타로 들어왔을 때 범용적으로 영타 자판 복원 처리
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(cmd) && !cmd.startsWith('/')) {
      cmd = convertKoreanToEnglish(cmd).toUpperCase();
    }
  }

  // 2. 특수 기호 알리어스
  if (cmd === ']') cmd = 'A';
  if (cmd === '[' || cmd === '[[') cmd = 'N';

  // 3. 리스트 화면 공통
  const isListScreen = ['main', 'board-select', 'post-list', 'weather-menu', 'news-menu', 'news-list', 'chat-lobby', 'memos-list'].includes(stateScreen);
  if (isListScreen) {
    if (cmd === 'DIR' || cmd === 'LIST') cmd = 'L';
    if (cmd === 'CAT' || cmd === 'TYPE') cmd = 'V';
  }

  // 4. 게시판 목록 특화 정규화 (SW -> LT, SI/SN/LN -> LI)
  // [LOG: 20260429_1535] CMD_UPDATE_PLAN.txt 기준 검색 명령 통합
  if (stateScreen === 'post-list' || stateScreen === 'post-view') {
    if (cmd === 'SW') cmd = 'LT';
    if (cmd === 'SI' || cmd === 'SN' || cmd === 'LN') cmd = 'LI';
  }

  // 5. 부분 일치 보정 (Prefix Match)
  // 단, cmd가 2글자 이상일 때만 (너무 짧으면 오작동 위험)
  // 기존에 정의된 명령어(CMD_META에 있는 것)가 아닐 경우에만 시도
  const commonCommands = ['H', 'P', 'T', 'M', 'N', 'A', 'F', 'B', 'L', 'W', 'R', 'E', 'D', 'V', 'U', 'S', 'X', 'Z', 'C', 'Q'];
  if (cmd.length >= 2 && !commonCommands.includes(cmd)) {
    const bestMatch = getBestMatch(cmd);
    if (bestMatch && bestMatch !== cmd) {
      cmd = bestMatch;
    }
  }

  // 재조합
  return args.length > 0 ? `${cmd} ${args.join(' ')}` : cmd;
}

/**
 * [LOG_ID: 20260710_1203] 한글 오타(Dubeolsik)를 QWERTY 영문 자판으로 실시간 번역
 */
function convertKoreanToEnglish(text) {
  const chosungs = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
  const jungsungs = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'y', 'm', 'ml', 'l'];
  const jongsungs = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
  
  const singleMap = {
    'ㄱ': 'r', 'ㄲ': 'R', 'ㄴ': 's', 'ㄷ': 'e', 'ㄸ': 'E', 'ㄹ': 'f', 'ㅁ': 'a',
    'ㅂ': 'q', 'ㅃ': 'Q', 'ㅅ': 't', 'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w', 'ㅉ': 'W',
    'ㅊ': 'c', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
    'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j', 'ㅔ': 'p', 'ㅕ': 'u',
    'ㅖ': 'P', 'ㅗ': 'h', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅠ': 'y', 'ㅡ': 'm', 'ㅣ': 'l'
  };

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const cho = Math.floor(offset / 588);
      const jung = Math.floor((offset % 588) / 28);
      const jong = offset % 28;
      
      result += chosungs[cho] + jungsungs[jung] + jongsungs[jong];
    } else {
      const char = text.charAt(i);
      result += singleMap[char] || char;
    }
  }
  return result;
}
