import { createMenuNavigationActions } from './menuNavigationActions.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
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
    findBoardByCode,
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
    hydrateBoards,
    hydrateMenuTree,
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

  let cachedMenuAliasLookup = null;
  const menuAliasTargetCache = new Map();
  const localMenuTargetCache = new WeakMap();
  const localBoardTargetCache = new WeakMap();

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
    // [LOG_ID: 20260805_0451] The complete board list already has a cached
    // code/door/name index. Keep scanning only for menu-local subsets.
    if (boards === state.boards && typeof findBoardByCode === 'function') {
      return findBoardByCode(normalized);
    }

    if (!Array.isArray(boards)) return null;
    let cached = localBoardTargetCache.get(boards);
    if (!cached || cached.size !== boards.length) {
      cached = { size: boards.length, values: new Map() };
      localBoardTargetCache.set(boards, cached);
    }
    if (cached.values.has(normalized)) {
      return cached.values.get(normalized);
    }

    // [LOG_ID: 20260805_0852] Cache menu-local board hits and misses so a
    // repeated GO code does not normalize every board field again.
    const targetBoard = boards.find((board) => {
      const keys = [
        getBoardDoor(board),
        getBoardKey(board),
        getBoardCode(board),
        getBoardDisplayName(board)
      ].map(normalizeSearchKey);
      return keys.includes(normalized);
    }) || null;
    if (cached.values.size >= 64) {
      cached.values.delete(cached.values.keys().next().value);
    }
    cached.values.set(normalized, targetBoard);
    return targetBoard;
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

  function resolveLocalMenuNodeTarget(target, menuNode) {
    if (!menuNode || typeof menuNode !== 'object') return null;
    const normalized = normalizeSearchKey(target);
    if (!normalized) return null;

    const source = Array.isArray(menuNode.children) ? menuNode.children : [];
    let cached = localMenuTargetCache.get(menuNode);
    if (!cached || cached.source !== source || cached.size !== source.length) {
      cached = { source, size: source.length, values: new Map() };
      localMenuTargetCache.set(menuNode, cached);
    }
    if (cached.values.has(normalized)) {
      return cached.values.get(normalized);
    }

    // [LOG_ID: 20260805_0754] Keep local-menu priority without rebuilding and
    // rescanning the same child list for repeated board GO commands.
    const targetNode = resolveMenuNodeTarget(target, getMenuChildren(menuNode));
    if (cached.values.size >= 64) {
      cached.values.delete(cached.values.keys().next().value);
    }
    cached.values.set(normalized, targetNode);
    return targetNode;
  }

  function resolveAnyMenuNodeTarget(target) {
    // [LOG_ID: 20260805_0352] GO codes are already indexed while the menu is
    // hydrated. Resolve exact codes in O(1) and keep the scan for aliases.
    const normalized = normalizeSearchKey(target);
    const lookup = state.menuLookup || {};
    const lowerKey = normalized.toLowerCase();
    const directNode = Object.hasOwn(lookup, normalized)
      ? lookup[normalized]
      : (Object.hasOwn(lookup, lowerKey) ? lookup[lowerKey] : null);
    if (directNode) return directNode;

    // [LOG_ID: 20260805_0652] Repeated GO targets that are board codes still
    // miss the menu index first. Cache alias hits and misses for the active
    // menu lookup, and bound the cache so arbitrary command input cannot grow it.
    if (cachedMenuAliasLookup !== lookup) {
      cachedMenuAliasLookup = lookup;
      menuAliasTargetCache.clear();
    }
    if (menuAliasTargetCache.has(normalized)) {
      return menuAliasTargetCache.get(normalized);
    }

    const aliasNode = resolveMenuNodeTarget(target, Object.values(lookup));
    if (menuAliasTargetCache.size >= 64) {
      menuAliasTargetCache.delete(menuAliasTargetCache.keys().next().value);
    }
    menuAliasTargetCache.set(normalized, aliasNode);
    return aliasNode;
  }

  // [LOG_ID: 20260804_1405] Share one in-flight public bootstrap request
  // between the eager startup preload and the eventual screen renderer.
  function preloadBootstrap() {
    if (state._bootstrapPromise) {
      return state._bootstrapPromise;
    }
    state._bootstrapPromise = apiFetch('/api/bootstrap').catch((error) => {
      state._bootstrapPromise = null;
      throw error;
    });
    return state._bootstrapPromise;
  }

  // [LOG_ID: 20260828_1800] 하이텔 원전의 초기 화면은 최신 공지를
  // "작은공지" 한 줄로 보여주고 `(GO NOTICE)`로 바로 이동할 수 있었다.
  // 대문 메뉴 자체를 막지 않도록 실패 시 null을 반환하며, 짧은 캐시와
  // in-flight 공유로 메뉴 재진입 때 불필요한 요청을 반복하지 않는다.
  function preloadLatestNotice() {
    const cached = state._latestNoticeCache;
    if (cached && (Date.now() - cached.at) < 30 * 1000) {
      return Promise.resolve(cached.text);
    }
    if (state._latestNoticePromise) {
      return state._latestNoticePromise;
    }

    const request = apiFetch('/api/boards/notice?page=1&pageSize=1', { silent: true })
      .then((result) => {
        const title = String(result?.items?.[0]?.title || '').trim();
        return title ? `[작은공지] ${title}` : null;
      })
      .catch(() => null)
      .then((text) => {
        state._latestNoticeCache = { at: Date.now(), text };
        return text;
      })
      .finally(() => {
        state._latestNoticePromise = null;
      });

    state._latestNoticePromise = request;
    return request;
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
        // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.warn 주석 처리
        // console.warn('HOME 리다이렉션 에러:', err.message);
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

    // [LOG_ID: 20260804_1114] 게시판, 메뉴, 통계를 한 번의 서버 병렬 조회로 받아
    // 초기 화면의 HTTP/serverless 왕복을 줄인다. 개별 로더는 딥링크 경로에서 계속 사용한다.
    const [bootstrap, noticeText] = await Promise.all([
      preloadBootstrap(),
      preloadLatestNotice()
    ]);
    hydrateBoards(bootstrap?.boards);
    const menuTree = hydrateMenuTree(bootstrap?.menu);
    const stats = bootstrap?.stats || {};
    state.stats = stats;

    // [LOG: 20260611_1400] Clear loading timer before rendering to prevent overwriting content
    setReady(true);
    // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드
    if (state.screen !== 'main') return;

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

  // [LOG_ID: 20260713_1230] 나우누리식 게시판 메뉴 ( 신규 / 전체 ) 건수 로드 (60초 캐시,
  // 실패 시 표기만 생략되도록 조용히 무시)
  async function loadBoardCounts() {
    const cached = state._boardCounts;
    if (cached && (Date.now() - cached.at) < 60 * 1000) {
      return;
    }
    try {
      const counts = await apiFetch('/api/boards/counts');
      state._boardCounts = { at: Date.now(), data: counts || {} };
    } catch (error) {
      void error;
      state._boardCounts = { at: Date.now(), data: {} };
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

    await Promise.all([loadBoards(), loadMenuTree(), loadBoardCounts()]);

    // [LOG: 20260611_1405] Clear loading timer before rendering
    setReady(true);
    // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드
    if (state.screen !== (menuPath === 'top' ? 'main' : 'board-select')) return;

    const menuNode = menuPath === 'top'
      ? state.menuTree
      : getMenuNodeByKey(menuPath);
    if (!menuNode) {
      // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
      // console.error('메뉴 화면 진입 실패:', menuPath);
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
    resolveLocalMenuNodeTarget,
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
    preloadBootstrap,
    resolveAnyMenuNodeTarget,
    resolveLocalMenuNodeTarget,
    resolveBoardTarget,
    resolveMenuNodeTarget,
    showBoardSelect,
    showMain
  };
}
