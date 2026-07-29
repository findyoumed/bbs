import { createBrowseCommandHandler } from './commandRouterBrowse.js';
import { createChatCommandHandler } from './commandRouterChat.js';
import { createEntryCommandHandler } from './commandRouterEntry.js';
import { createPostViewCommandHandler } from './commandRouterPostView.js';
import { createServiceCommandHandler } from './commandRouterService.js';
import { createMemoCommandHandler } from './commandRouterMemo.js';
import { createMyInfoCommandHandler } from './commandRouterMyInfo.js';

const TYPO_MAP = {
  // [LOG: 20260729_1637] 두벨식 한글 키보드 매핑 수정: 'ㅔ'(키: p)를 P로, 'ㅣ'(키: l)를 L로 자정.
  'ㅔ': 'P', 'ㅡ': 'M', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅁ': 'A', 'ㄹ': 'F', 'ㅣ': 'L', 'ㅅ': 'T',
  'ㅈ': 'W', 'ㄱ': 'R', 'ㄷ': 'E', 'ㅇ': 'D', 'ㄴ': 'S', 'ㅍ': 'V', 'ㅊ': 'C', 'ㅐ': 'O',
  'ㅗ': 'H', 'ㅂ': 'Q', 'ㅌ': 'X', 'ㅛ': 'Y',
  'ㅎㅐ': 'GO', 'ㄲㄷ': 'RE', 'ㄷㄷ': 'ED', 'ㅇㄷ': 'DD', 'ㅣㅅ': 'LT', 'ㅣㅑ': 'LI'
};

export function createCommandHandler(deps) {
  const {
    executeGoCommand,
    doLogout,
    setHint,
    showHelp,
    showMemoList,
    showMyInfo,
    openNicknameChange,
    openPasswordChange,
    showPostList,
    toggleTheme,
    state
  } = deps;

  const handleEntryCommand = createEntryCommandHandler(deps);
  const handleBrowseCommand = createBrowseCommandHandler(deps);
  const handleServiceCommand = createServiceCommandHandler(deps);
  const handleChatCommand = createChatCommandHandler(deps);
  const handlePostViewCommand = createPostViewCommandHandler(deps);
  const handleMemoCommand = createMemoCommandHandler(deps);
  const handleMyInfoCommand = createMyInfoCommandHandler(deps);

  async function handleGlobalCommand(cmd) {
    if (cmd === 'ME' || cmd === 'MEMO') {
      if (state.user?.isGuest) {
        setHint('쪽지 기능은 로그인 후 이용하실 수 있습니다.');
        return true;
      }
      await showMemoList();
      return true;
    }
    if (cmd === 'C') {
      toggleTheme();
      // [LOG: 20260609_1136] 터미널 테마 변경 힌트 표시 제거 (원래 힌트바 유지)
      return true;
    }
    if (cmd === 'H' || cmd === 'HELP' || cmd === '?') {
      await showHelp();
      return true;
    }
    if (cmd === 'Q' || cmd === 'EXIT' || cmd === 'BYE' || cmd === 'X' || cmd === 'LOGOUT') {
      // [LOG: 20260729_1631] 확인 다이얼로그 제거 — 즉시 로그아웃 후 재로드
      await doLogout();
      window.location.reload();
      return true;
    }
    return false;
  }

  return async function handleCmd(input) {
    let rawCmd = String(input || '').trim();
    const typo = TYPO_MAP[rawCmd.toLowerCase()];
    if (typo) {
      rawCmd = typo;
    }

    if (!rawCmd) {
      if (state._chatRoomCreateStage || state._deleteConfirmStage) {
        // pass through
      } else if (state.screen === 'post-list' && state.page < state.totalPages) {
        await showPostList(state.board.id, state.page + 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        });
        return;
      } else {
        return;
      }
    }

    const cmd = rawCmd.toUpperCase();

    if (await executeGoCommand(rawCmd)) {
      return;
    }
    if (await handleGlobalCommand(cmd)) {
      return;
    }
    if (await handleEntryCommand({ input, rawCmd, cmd })) {
      return;
    }
    if (await handleBrowseCommand({ input, rawCmd, cmd })) {
      return;
    }
    if (await handleServiceCommand({ s: state.screen, input, rawCmd, cmd })) {
      return;
    }
    if (await handleChatCommand({ input, rawCmd, cmd })) {
      return;
    }
    if (await handleMemoCommand({ input, rawCmd, cmd })) {
      return;
    }
    if (await handleMyInfoCommand({ input, rawCmd, cmd })) {
      return;
    }
    await handlePostViewCommand({ input, rawCmd, cmd });
  };
}
