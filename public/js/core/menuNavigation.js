import { createMenuNavigationActions } from './menuNavigationActions.js';
import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

export function createMenuNavigation(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildBoardSelectAnsi,
    buildMainMenuAnsi,
    buildMenuHotspotsFromRows,
    cmdInput,
    compareDoor,
    getBoardCode,
    getBoardDisplayName,
    getBoardDoor,
    getBoardKey,
    getCommandFooterText,
    getSupportedFooterText,
    getMenuChildren,
    getMenuEntries,
    getMenuNodeByKey,
    getMenuNodeCode,
    getMenuNodeKey,
    getMenuNodeLabel,
    getMenuNodeTitle,
    loadBoards,
    loadMenuTree,
    normalizeSearchKey,
    refs,
    renderMenuHotspots,
    renderScreenSequential,
    screenEl,
    setHint,
    setPrompt,
    state,
    updateURL
  } = deps;

  function getBoardSelectTitle(menuPath = 'top') {
    if (menuPath === 'top' && state.menuTree) {
      return getMenuNodeTitle(state.menuTree);
    }
    const node = getMenuNodeByKey(menuPath);
    if (node) {
      return getMenuNodeTitle(node);
    }
    const key = String(menuPath || 'top').trim() || 'top';
    return key === 'top' ? '01410 (TOP)' : `${key.toUpperCase()} (MENU)`;
  }

  function resolveBoardTarget(target, boards = state.boards) {
    const normalized = normalizeSearchKey(target);
    if (!normalized) return null;

    return (boards || []).find((board) => {
      const keys = [
        getBoardDoor(board),
        getBoardKey(board),
        getBoardCode(board),
        getBoardDisplayName(board)
      ].map(normalizeSearchKey);
      return keys.includes(normalized);
    }) || null;
  }

  function resolveMenuNodeTarget(target, nodes) {
    const normalized = normalizeSearchKey(target);
    if (!normalized) return null;

    return (nodes || []).find((node) => {
      const keys = [
        node?.door,
        node?.go,
        node?.id,
        getMenuNodeLabel(node),
        getMenuNodeCode(node)
      ].map(normalizeSearchKey);
      return keys.includes(normalized);
    }) || null;
  }

  function resolveAnyMenuNodeTarget(target) {
    return resolveMenuNodeTarget(target, Object.values(state.menuLookup || {}));
  }

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  async function showMain(fromHistory = false) {
    state.screen = 'main';
    state.boardMenuPath = 'top';
    state.boardMenuTitle = getBoardSelectTitle('top');
    state.boardMenuEntries = [];

    if (!fromHistory) {
      void updateURL();
    }

    screenEl.innerHTML = '<div class="loading">연결하는 중 입니다...</div>';
    setHint('');
    setPrompt('');

    // [LOG: 20260426_1110] 메뉴 로드 시 시스템 통계도 병렬로 로드
    const [, menuTree, stats] = await Promise.all([
      loadBoards(),
      loadMenuTree(),
      fetch('/api/system/stats').then(res => res.ok ? res.json() : null).catch(() => null)
    ]);

    if (!menuTree) {
      screenEl.innerHTML = '<div class="bbs-error">메뉴를 불러오지 못했습니다.</div>';
      setHint('메뉴 로드 실패');
      setPrompt('>>');
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
      }
      return;
    }

    state.boardMenuPath = getMenuNodeKey(menuTree) || 'top';
    state.boardMenuTitle = getMenuNodeTitle(menuTree);
    state.boardMenuEntries = getMenuChildren(menuTree);

    const menuEntries = getMenuEntries(state.boardMenuEntries);
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildMainMenuAnsi(state.boardMenuTitle, menuEntries, stats),
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });

    if (screenEl) {
      renderMenuHotspots(
        rendered.screenNode,
        buildMenuHotspotsFromRows(rendered.rows, menuEntries, compareDoor)
      );
    }

    if (!fromHistory && window.location.pathname !== '/') {
      void updateURL();
    }

    await applyCommandFooter(menuTree.footer, getCommandFooterText('top'));
    // [LOG: 20260424_2020] 모바일에서 메뉴 진입 시 키보드 자동 팝업 방지
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showBoardSelect(menuPath = 'top', title = getBoardSelectTitle(menuPath), fromHistory = false) {
    if (menuPath === 'pds' && typeof refs.showPostList === 'function') {
      await refs.showPostList('pds', 1, {
        menuPath: 'top',
        menuTitle: '자료실'
      }, fromHistory);
      return;
    }

    state.screen = menuPath === 'top' ? 'main' : 'board-select';
    state.boardMenuPath = menuPath;
    state.boardMenuTitle = title;
    if (!fromHistory) {
      void updateURL();
    }

    screenEl.innerHTML = '<div class="loading">연결하는 중 입니다...</div>';
    setHint('');
    setPrompt('');

    await Promise.all([loadBoards(), loadMenuTree()]);

    const menuNode = menuPath === 'top'
      ? state.menuTree
      : getMenuNodeByKey(menuPath);
    if (!menuNode) {
      console.error('메뉴 화면 진입 실패:', menuPath);
      await showMain();
      return;
    }

    state.boardMenuPath = getMenuNodeKey(menuNode) || 'top';
    state.boardMenuTitle = title || getMenuNodeTitle(menuNode);
    state.boardMenuEntries = getMenuChildren(menuNode);

    const menuEntries = getMenuEntries(state.boardMenuEntries);
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildBoardSelectAnsi(menuEntries, state.boardMenuTitle),
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });

    if (screenEl) {
      renderMenuHotspots(
        rendered.screenNode,
        buildMenuHotspotsFromRows(rendered.rows, menuEntries, compareDoor)
      );
    }

    await applyCommandFooter(menuNode.footer, getSupportedFooterText(state) || getCommandFooterText('menu'));
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  const { executeGoCommand, executeMenuNodeAction } = createMenuNavigationActions({
    cmdInput,
    getBoardKey,
    getBoardMenuPath: deps.getBoardMenuPath,
    getMenuChildren,
    getMenuNodeByKey,
    getMenuNodeKey,
    getMenuNodeTitle,
    getMenuParentNode: deps.getMenuParentNode,
    getBoardSelectTitle,
    normalizeSearchKey,
    refs,
    resolveAnyMenuNodeTarget,
    resolveBoardTarget,
    resolveMenuNodeTarget,
    setHint: deps.setHint,
    setPrompt: deps.setPrompt,
    showBoardSelect,
    showMain,
    startOAuthLogin: deps.startOAuthLogin,
    state
  });

  async function handleHistoryBack() {
    const currentPath = window.location.pathname + window.location.search;
    if (window.history.length > 1 && currentPath !== '/') {
      window.history.back();
      return;
    }

    if (state.screen === 'memo-view' || state.screen === 'memo-write') {
      if (typeof refs.showMemoList === 'function') {
        await refs.showMemoList();
      } else {
        await showMain();
      }
      return;
    }

    if (state.screen !== 'main') {
      await showMain();
    }
  }

  return {
    executeGoCommand,
    executeMenuNodeAction,
    getBoardSelectTitle,
    handleHistoryBack,
    resolveAnyMenuNodeTarget,
    resolveBoardTarget,
    resolveMenuNodeTarget,
    showBoardSelect,
    showMain
  };
}
