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
    handleHistoryBack,
    setHint,
    setPrompt,
    findBoardByCode,
    showPostList,
    showLogin,
    showConfirm
  } = deps;

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function isLoginShortcutScreen() {
    return ['main', 'board-select', 'top'].includes(state.screen);
  }

  return async function handleGlobalNavigationCommand({ cmd, rawCmd }) {
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
      await handleHistoryBack();
      return true;
    }

    if (cmd === 'Q' || cmd === 'EXIT' || cmd === 'BYE' || cmd === 'X' || cmd === 'LOGOUT') {
      const confirmed = await showConfirm('BBS 접속을 종료하시겠습니까?');
      if (!confirmed) {
        setDefaultPrompt();
        return true;
      }

      if (!state.user?.isGuest) {
        await doLogout();
      }
      window.location.assign('/');
      return true;
    }

    return false;
  };
}
