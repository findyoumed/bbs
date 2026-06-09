import { CMD_META } from './commandService.js';

/**
 * commandFooterText.js
 * [LOG: 20260428_2002] Standardized command footer categories and screen mappings.
 */

export const CMD_ORDER = {
  top: ['GO', 'LOGIN', 'WHO', 'PF', 'C:바탕색', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  menu: ['P', 'T', 'GO', 'LOGIN', 'WHO', 'PF', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  authMenu: ['P', 'T', 'GO', 'H'],
  help: ['F', 'B', 'P', 'T', 'GO'],
  history: ['P', 'T', 'GO', 'H'],
  newsMenu: ['P', 'T', 'GO', 'LOGIN', 'H'],
  weatherMenu: ['P', 'T', 'GO', 'H'],
  weatherView: ['F', 'B', 'P', 'T', 'GO', 'H'],
  pdsList: ['F', 'B', 'P', 'T', 'GO', 'W:쓰기', 'LT:제목검색', 'LI:ID검색', 'H'],
  postList: ['F', 'B', 'L', 'P', 'T', 'GO', 'W:글쓰기', 'LT:제목검색', 'LI:ID검색', 'H'],
  postView: ['L:목록', 'N', 'A', 'P', 'T', 'GO', 'RE:답장', 'E:수정', 'D:삭제', 'V:추천', 'U:첨부', 'LT:제목검색', 'LI:ID검색', 'H'],
  postWrite: ['P:취소', 'S:저장', 'H'],
  chat: ['P', 'T', 'GO', 'O:방만들기', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  chatLobby: ['P', 'T', 'GO', 'O:방만들기', 'H'], // [LOG: 20260609_1135] HI(내정보) 삭제
  memoList: ['P', 'T', 'GO', 'W:쓰기', 'H'],
  memoView: ['L:목록', 'P', 'T', 'GO', 'RE:답장', 'DD:삭제', 'H'],
  memoWrite: ['P:취소', 'SEND:전송', 'H'],
  profile: ['P', 'T', 'GO', 'H'],
  myInfoView: ['P', 'T', 'GO', 'H'],
  myInfoEdit: ['P:취소', 'T', 'ENTER:변경', 'H'],
  myInfoDelete: ['P:취소', 'T', 'ENTER:탈퇴', 'H'],
  login: ['P', 'LOGIN', 'H'],
  passwordResetRequest: ['P:취소', 'SEND:전송', 'H'],
  passwordResetUpdate: ['P:취소', 'CHANGE:변경', 'H'],
  systemInfo: ['P', 'T', 'GO', 'H'],
  systemLog: ['P', 'T', 'GO', 'R:새로고침', 'C:지우기', 'CP:복사', 'H'],
  attachmentList: ['P', 'T', 'GO', 'H'],
  newsList: ['F', 'B', 'P', 'T', 'GO', 'H'],
  serviceArticle: ['F', 'B', 'N', 'A', 'P', 'T', 'PR:복사']
};

const SCREEN_TO_CATEGORY = {
  main: 'top',
  'board-select': 'menu',
  help: 'help',
  history: 'history',
  'post-list': 'postList',
  'post-view': 'postView',
  'post-write': 'postWrite',
  chat: 'chat',
  'chat-lobby': 'chatLobby',
  'chat-room': 'chat',
  'news-menu': 'newsMenu',
  'news-list': 'newsList',
  'news-view': 'serviceArticle',
  'weather-menu': 'weatherMenu',
  'weather-view': 'weatherView',
  'memo-list': 'memoList',
  'memo-view': 'memoView',
  'memo-write': 'memoWrite',
  profile: 'profile',
  'active-users': 'systemInfo',
  'activity-summary': 'systemInfo',
  'system-diagnostics': 'systemInfo',
  'system-log': 'systemLog',
  'attachment-list': 'attachmentList',
  login: 'login',
  signup: 'authMenu'
};

export function createCommandFooterTextUtils(deps) {
  const { state } = deps;
  const DEFAULT_COMMAND_PROMPT = '선택 >> ';

  function formatCommandToken(token) {
    const [cmdPart, labelPart = ''] = String(token || '').split(':');
    const cmd = String(cmdPart || '').trim().toUpperCase();
    if (!cmd) return '';

    if (String(labelPart || '').trim() === '!') {
      return cmd;
    }

    const label = String(labelPart || CMD_META[cmd]?.label || cmd).trim();
    return label && label.toUpperCase() !== cmd
      ? `${label}(${cmd})`
      : cmd;
  }

  function formatCommandFooter(order) {
    const tokens = (Array.isArray(order) ? order : [])
      .map(formatCommandToken)
      .filter(Boolean);
    return tokens.length ? `${tokens.join(', ')}\n${DEFAULT_COMMAND_PROMPT}` : '';
  }

  function getCommandFooterText(category) {
    if (category === 'newsList') {
      return '상위(P), 초기메뉴(T), 다음쪽(F), 이전쪽(B), 직접이동(GO), 명령어안내(H)\n선택 >> ';
    }

    const order = Array.isArray(CMD_ORDER[category]) ? CMD_ORDER[category] : [];
    return formatCommandFooter(order);
  }

  function getSupportedFooterText(nextState = state) {
    const currentState = nextState || state || {};
    const currentScreen = String(currentState.screen || '').trim();

    if (!currentScreen) {
      return getCommandFooterText('top');
    }

    // [LOG: 20260429_1033] /log uses the shared board-select screen, but its
    // auth menu footer should not advertise the LOGIN shortcut in the hint bar.
    if (currentScreen === 'board-select' && String(currentState.boardMenuPath || '').trim().toLowerCase() === 'log') {
      return getCommandFooterText('authMenu');
    }

    // [LOG: 20260429_1033] Unified PDS list keeps paging/search hints but
    // omits the first-page shortcut token from the shared footer.
    if (currentScreen === 'post-list') {
      const boardId = String(currentState.board?.boardId || currentState.board?.id || '').trim().toLowerCase();
      if (boardId === 'pds') {
        return getCommandFooterText('pdsList');
      }
    }

    if (currentScreen === 'myinfo') {
      const mode = String(currentState._myInfoMode || 'view').trim().toLowerCase();
      if (mode === 'delete') return getCommandFooterText('myInfoDelete');
      if (mode === 'nickname' || mode === 'email' || mode === 'password') return getCommandFooterText('myInfoEdit');
      return getCommandFooterText('myInfoView');
    }

    if (currentScreen === 'password-reset') {
      return getCommandFooterText(
        currentState._passwordResetMode === 'update'
          ? 'passwordResetUpdate'
          : 'passwordResetRequest'
      );
    }

    const category = SCREEN_TO_CATEGORY[currentScreen];
    return category ? getCommandFooterText(category) : '';
  }

  return { getCommandFooterText, getSupportedFooterText };
}
