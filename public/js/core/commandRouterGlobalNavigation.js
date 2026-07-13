import { CMD_META } from './commandService.js';

export function createGlobalNavigationCommandHandler(deps) {
  const {
    state,
    doLogout,
    toggleHintExpansion,
    executeGoCommand,
    showProfile,
    showActiveUsers,
    showMyInfo,
    showHelp,
    showHistory,
    showPolicy,
    handleHistoryBack,
    setHint,
    setPrompt,
    findBoardByCode,
    showPostList,
    showLogin,
    showConfirm,
    showMemoWrite
  } = deps;

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function isLoginShortcutScreen() {
    return ['main', 'board-select', 'top'].includes(state.screen);
  }

  return async function handleGlobalNavigationCommand({ cmd, rawCmd, input }) {
    // [LOG_ID: 20260713_1130] 하이텔식 종료 확인 가로채기
    if (state._exitConfirm) {
      const ans = String(input || cmd || '').trim().toUpperCase();
      state._exitConfirm = false;
      setDefaultPrompt();

      if (ans === 'Y' || ans === 'YES') {
        setHint('안녕히 가십시오.');
        await new Promise(r => setTimeout(r, 600));

        if (!state.user?.isGuest) {
          await doLogout();
        }
        window.location.assign('/');
        return true;
      } else {
        setHint('종료가 취소되었습니다.');
        setDefaultPrompt();
        return true;
      }
    }

    if (cmd === 'LOGIN' || (cmd === 'L' && isLoginShortcutScreen())) {
      if (state.user?.isGuest) {
        if (typeof showLogin === 'function') {
          showLogin();
          return true;
        }
        return false;
      }

      if (cmd === 'LOGIN') {
        setHint('이미 로그인되어 있습니다.');
        setDefaultPrompt();
        return true;
      }
    }

    if (cmd.startsWith('/') || cmd.startsWith('FIND ')) {
      // [LOG: 20260703_1720] 대화실에서는 '/' 입력이 채팅 명령(/Q, /QUIT, /ST, /AL 등)이고
      // 일반 텍스트는 메시지이므로, 전역 검색이 가로채지 않고 chat 핸들러(commandRouterChat)로 넘긴다.
      // 대화방 개설 단계(chat-lobby + _chatRoomCreateStage)의 '/M' 취소 입력도 동일하게 보호한다.
      if (state.screen === 'chat-room' || (state.screen === 'chat-lobby' && state._chatRoomCreateStage)) {
        return false;
      }
      const query = cmd.startsWith('/') ? rawCmd.slice(1).trim() : rawCmd.slice(5).trim();
      if (!query) {
        setHint('검색어를 입력해 주세요. (예: /안녕 또는 FIND 안녕)');
        setPrompt('검색어 >>');
        return true;
      }

      const lowerQuery = query.toLowerCase();

      if (state.screen === 'post-list' && state.board) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { lt: query }
        });
        return true;
      }

      const targetBoard = findBoardByCode(query);
      if (targetBoard) {
        setHint(`${targetBoard.name} 게시판으로 이동합니다...`);
        await showPostList(targetBoard.id || targetBoard.boardId, 1, {
          menuPath: targetBoard.menuPath || 'top',
          menuTitle: targetBoard.menuTitle || '게시판'
        });
        return true;
      }

      if (deps.menuService) {
        const menuTree = state.menuTree || (await deps.menuService.loadMenuTree());
        const findInNodes = (nodes) => {
          for (const node of nodes) {
            const label = (deps.menuService.getMenuNodeLabel(node) || '').toLowerCase();
            const code = (node.go || node.door || '').toLowerCase();
            if (label.includes(lowerQuery) || (code && code.includes(lowerQuery))) {
              return node;
            }
            if (node.children) {
              const found = findInNodes(node.children);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };

        const targetNode = findInNodes(menuTree || []);
        if (targetNode) {
          setHint(`메뉴 [${deps.menuService.getMenuNodeLabel(targetNode)}] 로 이동합니다...`);
          await executeGoCommand(targetNode.go || targetNode.door || targetNode.id);
          return true;
        }
      }

      const commandService = deps.commandService || { CMD_META };
      const meta = commandService.CMD_META || CMD_META;
      const cmdKey = Object.keys(meta).find((key) =>
        key.toLowerCase().includes(lowerQuery)
        || (meta[key].label || '').toLowerCase().includes(lowerQuery)
        || (meta[key].desc || '').toLowerCase().includes(lowerQuery)
      );

      if (cmdKey) {
        const commandMeta = meta[cmdKey];
        setHint(`명령어 정보: ${commandMeta.label}[${cmdKey}]\n설명: ${commandMeta.desc || ''}\n도움말: ${commandMeta.tip || ''}`);
        setDefaultPrompt();
        return true;
      }

      if (state.screen === 'news-list' && state.serviceData?.topicDoor) {
        setHint('뉴스 검색 기능은 준비 중입니다.');
        setDefaultPrompt();
        return true;
      }

      setHint(`[${query}] 에 대한 게시판, 메뉴 또는 명령어를 찾을 수 없습니다.`);
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'H' || cmd.startsWith('HELP') || cmd === '?') {
      const helpMatch = rawCmd.match(/^(HELP|H)\s+(.+)$/i);
      if (helpMatch) {
        await showHelp(helpMatch[2].trim());
      } else {
        await showHelp();
      }
      return true;
    }

    if (state.screen === 'help') {
      // [LOG_ID: 20260713_1230] 나우누리 GUIDE '명령어안내'식 분류 선택 — 0.전체 1~6.분류
      if (/^[0-6]$/.test(cmd)) {
        const helpTabKeys = ['NAV', 'POST', 'AUTH', 'MEMO', 'CHAT', 'UI'];
        state.helpTab = cmd === '0' ? 'all' : helpTabKeys[Number(cmd) - 1];
        await showHelp('', 1);
        return true;
      }
      if (cmd === 'F') {
        const nextPage = (state.page || 1) + 1;
        if (nextPage <= (state.helpTotalPages || 1)) {
          await showHelp('', nextPage);
        }
        return true;
      }
      if (cmd === 'B') {
        const prevPage = (state.page || 1) - 1;
        if (prevPage >= 1) {
          await showHelp('', prevPage);
        }
        return true;
      }
    }

    // [LOG_ID: 20260713_2100] GUIDE 이용약관/개인정보처리방침 뷰어 페이징 (help와 동일 패턴)
    if (state.screen === 'policy') {
      if (cmd === 'F') {
        const nextPage = (state.page || 1) + 1;
        if (nextPage <= (state.policyTotalPages || 1)) {
          await showPolicy(state.policyKind, nextPage);
        }
        return true;
      }
      if (cmd === 'B') {
        const prevPage = (state.page || 1) - 1;
        if (prevPage >= 1) {
          await showPolicy(state.policyKind, prevPage);
        }
        return true;
      }
    }

    if (cmd === '+') {
      toggleHintExpansion();
      return true;
    }

    if (await executeGoCommand(rawCmd)) {
      return true;
    }

    const whoMatch = cmd.match(/^(WHO|WH|PF)\s+(.+)$/);
    if (whoMatch) {
      await showProfile(whoMatch[2].trim());
      return true;
    }

    const isWriteConflictScreen = ['post-list', 'memo-list', 'post-write', 'memo-write', 'login', 'password-reset', 'signup'].includes(state.screen);
    if (cmd === 'USER' || cmd === 'WHO' || cmd === 'WH' || (cmd === 'W' && !isWriteConflictScreen)) {
      await showActiveUsers();
      return true;
    }

    if (cmd === 'HI' || cmd === 'MYINFO' || cmd === 'PF') {
      if (state.user?.isGuest) {
        setHint('정보관리 및 프로필 편집은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      await showMyInfo();
      return true;
    }

    // [LOG_ID: 20260713_1160] 전역 ME / MEMO / CMAIL 명령어 배선 추가 (나우누리 편지함 조회)
    if (cmd === 'ME' || cmd === 'MEMO' || cmd === 'CMAIL') {
      if (state.user?.isGuest) {
        setHint('쪽지함은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      if (typeof showMemoList === 'function') {
        // 처음 진입할 때 기본적으로 받은편지함(inbox)으로 설정되도록 초기화
        state._memoBox = 'inbox';
        await showMemoList();
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260713_1160] 나우누리 편지쓰기(WMAIL) 명령어 배선 추가
    if (cmd === 'WMAIL') {
      if (state.user?.isGuest) {
        setHint('쪽지 기능은 로그인 후 사용하실 수 있습니다.');
        setDefaultPrompt();
        return true;
      }
      if (typeof showMemoWrite === 'function') {
        await showMemoWrite();
        return true;
      }
      return false;
    }

    if (cmd === 'CLS' || cmd === 'CLEAR') {
      if (typeof deps.renderScreenSequential === 'function') {
        await deps.renderScreenSequential('', { clear: true });
      }
      setHint('화면이 초기화되었습니다.');
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'HIST') {
      await showHistory();
      return true;
    }

    if (cmd === 'Z') {
      // [LOG_ID: 20260712_2130] Z를 하이텔 원전 의미(길라잡이 p.90 "잡음이 끼어들어 이상한 글자가
      // 나타날 때 'z'로 깨끗한 화면을 재전송")대로 "현재 화면 재그리기"로 변경(사용자 결정).
      // 종전의 '이전 화면'(handleHistoryBack) 동작을 대체하며, 현재 URL 기준 화면 재구성 배관
      // (restoreStateFromURL, fromHistory 경로)을 재사용해 서버 재조회 + 재렌더한다.
      if (typeof deps.refs?.restoreStateFromURL === 'function') {
        await deps.refs.restoreStateFromURL();
        return true;
      }
      await handleHistoryBack();
      return true;
    }

    // [LOG_ID: 20260713_1140] 하이텔식 이용시간 확인(TIME) 커맨드 구현
    if (cmd === 'TIME') {
      const elapsedMs = Date.now() - (state._sessionStartTime || Date.now());
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
      const now = new Date();
      const currentStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setHint(`[이용시간] 현재시각: ${currentStr} | 누적접속: ${elapsedMin}분 ${elapsedSec}초`);
      return true;
    }

    if (cmd === 'Q' || cmd === 'EXIT' || cmd === 'BYE' || cmd === 'X' || cmd === 'LOGOUT') {
      // [LOG_ID: 20260713_1130] 하이텔식 종료 확인 시퀀스로 전환
      state._exitConfirm = true;
      setHint('* 끝내시려면 \'Y\' 를 누르고 엔터키를 누르십시오');
      setPrompt('-> ');
      return true;
    }

    return false;
  };
}
