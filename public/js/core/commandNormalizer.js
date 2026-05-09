import { CMD_META, getBestMatch } from './commandService.js';

/**
 * [LOG: 20260425_2355] 입력 명령어 정규화 고도화
 * - 한글 오타 보정 및 특수문자 치환
 * - 존재하지 않는 명령어일 경우 부분 일치(Prefix Match) 보정 추가
 */
export function normalizeCommand(rawCmd, stateScreen) {
  // [LOG: 20260428_1730] Auto-Next Page: Map empty input (Enter key) to "F" for paged screens.
  if (!rawCmd || String(rawCmd).trim() === '') {
    const pagedScreens = ['help', 'post-list', 'board-select', 'news-list', 'memo-list', 'memos-list', 'weather-view', 'news-view'];
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
    '/ㅁ': '/Q', '/균ㅆ': '/QUIT', 'ㅐ': 'O'
  };

  // 1. 단일 키워드 정규화
  if (koAliasMap[cmd]) {
    cmd = koAliasMap[cmd];
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
