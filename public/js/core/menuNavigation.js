import { createMenuNavigationActions } from './menuNavigationActions.js';
import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createMenuNavigation(deps) {
  const {
    ansiToHTML,
    apiFetch,
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
    setLoading,
    setReady,
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

  async function showMain(fromHistory = false) {
    // [LOG_ID: 20260713_1010] SET HOME 환경 변수가 설정되어 있을 경우 초기 진입 시 해당 게시판/메뉴로 즉시 이동
    const homeTarget = String(state.envVars?.HOME || '').trim();
    if (homeTarget && !fromHistory && !state._isHomeRedirecting) {
      state._isHomeRedirecting = true;
      try {
        const handled = await executeGoCommand(`GO ${homeTarget}`);
        if (handled) {
          return;
        }
      } catch (err) {
        console.warn('HOME 리다이렉션 에러:', err.message);
      } finally {
        state._isHomeRedirecting = false;
      }
    }

    state.screen = 'main';
    state.boardMenuPath = 'top';
    state.boardMenuTitle = getBoardSelectTitle('top');
    state.boardMenuEntries = [];

    if (!fromHistory) {
      void updateURL();
    }

    // [LOG_ID: 20260708_1845] 여기서 setHint('')/setPrompt('')를 직접 호출해 즉시 비우던 것을 제거한다.
    // renderAnsiScreenWithTopbarSequential이 시작될 때 자기 자신의 인라인 숨김으로 이전 힌트/프롬프트를
    // 가리므로, 이 시점에 미리 비울 필요가 없다 — 오히려 데이터 로딩(아래 Promise.all)이 끝나기 전까지
    // "선택 >>" 프롬프트가 완전히 사라진 채(footer는 그대로 visible) 노출되는 깜빡임을 만들었다
    // ("space2처럼 넓어보였다가 좁아진다"는 재보고의 실제 원인 — 프롬프트 폭 문제가 아니라 텍스트
    // 자체가 순간 비었다 채워지는 것이었다). 20260708_1420의 setLoading() 힌트-즉시-비움 문제와 동일 계열.
    setLoading('연결하는 중입니다..');

    // [LOG: 20260712_2200] 메뉴 로드 시 시스템 통계 및 최신 공지글 병렬 로드
    const [, menuTree, stats, noticeData] = await Promise.all([
      loadBoards(),
      loadMenuTree(),
      fetch('/api/system/stats').then(res => res.ok ? res.json() : null).catch(() => null),
      apiFetch('/api/boards/notice?page=1&pageSize=1').catch(() => null)
    ]);

    // [LOG: 20260611_1400] Clear loading timer before rendering to prevent overwriting content
    setReady(true);

    if (!menuTree) {
      screenEl.innerHTML = '<div class="bbs-error">메뉴를 불러오지 못했습니다.</div>';
      setHint('메뉴 로드 실패');
      setPrompt('>>');
      setReady(true);
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
      }
      return;
    }

    state.boardMenuPath = getMenuNodeKey(menuTree) || 'top';
    state.boardMenuTitle = getMenuNodeTitle(menuTree);
    state.boardMenuEntries = getMenuChildren(menuTree);

    const menuEntries = getMenuEntries(state.boardMenuEntries);
    if (!fromHistory && window.location.pathname !== '/') {
      void updateURL();
    }

    let noticeText = null;
    if (noticeData && (noticeData.items?.length > 0 || noticeData.posts?.length > 0)) {
      const noticePost = noticeData.items?.[0] || noticeData.posts?.[0];
      if (noticePost && noticePost.title) {
        // [LOG_ID: 20260713_1060] (GO NOTICE) 클릭 가능 토큰을 포함한 텍스트로 보완
        noticeText = `[작은공지] ${noticePost.title} (GO NOTICE)`;
      }
    }

    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildMainMenuAnsi(state.boardMenuTitle, menuEntries, stats, noticeText),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(menuTree.footer, getCommandFooterText('top'));
      }
    });

    if (screenEl) {
      renderMenuHotspots(
        rendered.screenNode,
        buildMenuHotspotsFromRows(rendered.rows, menuEntries, compareDoor)
      );
    }

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

    // [LOG_ID: 20260708_1845] showMain()과 동일한 이유로 setHint('')/setPrompt('') 즉시 호출 제거.
    setLoading('연결하는 중입니다..');

    await Promise.all([loadBoards(), loadMenuTree()]);
    
    // [LOG: 20260611_1405] Clear loading timer before rendering
    setReady(true);

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
    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildBoardSelectAnsi(menuEntries, state.boardMenuTitle),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(menuNode.footer, getSupportedFooterText(state) || getCommandFooterText('menu'));
      }
    });

    if (screenEl) {
      renderMenuHotspots(
        rendered.screenNode,
        buildMenuHotspotsFromRows(rendered.rows, menuEntries, compareDoor)
      );
    }

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
