export function createMenuNavigationActions(deps) {
  const {
    cmdInput,
    getBoardKey,
    getBoardMenuPath,
    getMenuChildren,
    getMenuNodeByKey,
    getMenuNodeKey,
    getMenuNodeTitle,
    getMenuParentNode,
    getBoardSelectTitle,
    normalizeSearchKey,
    refs,
    resolveAnyMenuNodeTarget,
    resolveBoardTarget,
    resolveMenuNodeTarget,
    setHint,
    setPrompt,
    showBoardSelect,
    showMain,
    startOAuthLogin,
    state
  } = deps;

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  async function executeGoCommand(rawCmd) {
    const match = String(rawCmd || '').trim().match(/^GO\s+(.+)$/i);
    if (!match) return false;

    const target = match[1].trim();
    const normalized = normalizeSearchKey(target);
    if (normalized === 'TOP') {
      await showMain();
      return true;
    }

    const currentMenuNode = state.screen === 'main'
      ? state.menuTree
      : getMenuNodeByKey(state.boardMenuPath);
    const localTargetNode = resolveMenuNodeTarget(target, getMenuChildren(currentMenuNode));
    const targetNode = localTargetNode || resolveAnyMenuNodeTarget(target);
    if (targetNode) {
      const contextNode = localTargetNode ? currentMenuNode : getMenuParentNode(targetNode);
      await executeMenuNodeAction(
        targetNode,
        getMenuNodeKey(contextNode) || 'top',
        getMenuNodeTitle(contextNode || state.menuTree)
      );
      return true;
    }

    const contextBoards = state.screen === 'board-select' ? state.boardMenuEntries : state.boards;
    const targetBoard = resolveBoardTarget(target, contextBoards) || resolveBoardTarget(target, state.boards);
    if (!targetBoard || typeof refs.showPostList !== 'function') {
      return false;
    }

    const menuPathForBoard = state.screen === 'board-select'
      ? state.boardMenuPath
      : getBoardMenuPath(targetBoard);
    const menuTitleForBoard = state.screen === 'board-select'
      ? state.boardMenuTitle
      : getBoardSelectTitle(menuPathForBoard);
    await refs.showPostList(getBoardKey(targetBoard), 1, {
      menuPath: menuPathForBoard,
      menuTitle: menuTitleForBoard
    });
    return true;
  }

  async function executeMenuNodeAction(node, menuPath = '', menuTitle = '') {
    if (!node) return false;

    const nodeKey = getMenuNodeKey(node);
    const parentNode = getMenuParentNode(node);
    const contextMenuPath = String(menuPath || getMenuNodeKey(parentNode) || 'top').trim() || 'top';
    const contextMenuTitle = String(menuTitle || getMenuNodeTitle(parentNode || state.menuTree)).trim() || getBoardSelectTitle('top');
    const targetId = String(node?.go || node?.id || '').trim();

    if (node.type === 'menu') {
      if (nodeKey === 'pds' && typeof refs.showPostList === 'function') {
        await refs.showPostList('pds', 1, {
          menuPath: contextMenuPath,
          menuTitle: '자료실'
        });
        return true;
      }
      await showBoardSelect(nodeKey, getMenuNodeTitle(node));
      return true;
    }
    if (node.type === 'board' && targetId && typeof refs.showPostList === 'function') {
      await refs.showPostList(targetId, 1, {
        menuPath: contextMenuPath,
        menuTitle: contextMenuTitle
      });
      return true;
    }
    if (node.type === 'news' && typeof refs.showNewsMenu === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showNewsMenu();
      return true;
    }
    if (node.type === 'weather' && typeof refs.showWeatherMenu === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showWeatherMenu();
      return true;
    }
    if (node.type === 'chatt' && typeof refs.showChatLobby === 'function') {
      await refs.showChatLobby();
      return true;
    }
    if (node.type === 'login' && typeof refs.showLogin === 'function') {
      refs.showLogin();
      return true;
    }
    if (node.type === 'password-reset' && typeof refs.showPasswordReset === 'function') {
      refs.showPasswordReset();
      return true;
    }
    if (node.type === 'oauth-login') {
      const provider = String(node?.go || '').trim().toLowerCase();
      try {
        setHint(`${getMenuNodeTitle(node)} 인증 페이지로 이동합니다.`);
        setPrompt('>>');
        await startOAuthLogin(provider);
      } catch (error) {
        setHint(error.message || '소셜 로그인을 시작할 수 없습니다.');
        setPrompt('>>');
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
      }
      return true;
    }
    if (node.type === 'signup' && typeof refs.showSignup === 'function') {
      await refs.showSignup();
      return true;
    }
    if (node.type === 'myinfo' && typeof refs.showMyInfo === 'function') {
      refs.showMyInfo();
      return true;
    }

    return false;
  }

  return {
    executeGoCommand,
    executeMenuNodeAction
  };
}
