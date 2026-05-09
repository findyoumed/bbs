import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

export function createPostListView(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildPostListAnsi,
    cmdInput,
    getBoardKey,
    getBoardSelectTitle,
    getCommandFooterText,
    getSupportedFooterText,
    loadMenuTree,
    loadPosts,
    screenEl,
    state,
    updateURL,
    findBoardByKey,
    renderScreenSequential
  } = deps;

  function renderPostHotspots(screenNode, posts) {
    if (!screenNode || !posts.length) return;
    const layer = document.createElement('div');
    layer.className = 'ansi-hotspot-layer';
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    posts.forEach((post, index) => {
      const rowIdx = index; // Sequential body starts from row 0 of body
      if (!lineNodes[rowIdx]) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ansi-hotspot post-hotspot';
      btn.dataset.postid = String(post.id); btn.setAttribute('aria-label', post.title || '');
      const rect = lineNodes[rowIdx].getBoundingClientRect();
      const screenRect = screenNode.getBoundingClientRect();
      btn.style.left = '0'; btn.style.top = `${rect.top - screenRect.top}px`;
      btn.style.width = '100%'; btn.style.height = `${rect.height || 16}px`;
      layer.appendChild(btn);
    });
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  async function showPostList(boardId, page = 1, options = {}, fromHistory = false) {
    state.screen = 'post-list';
    const boardKey = String(boardId || '').trim();
    const hasExplicitMenuPath = options.menuPath !== undefined;
    const hasExplicitMenuTitle = options.menuTitle !== undefined;
    const contextPath = hasExplicitMenuPath ? options.menuPath : (state.boardMenuPath || 'top');
    state.boardMenuPath = contextPath;
    state.boardMenuTitle = hasExplicitMenuTitle ? options.menuTitle : getBoardSelectTitle(contextPath);
    state.board = findBoardByKey(boardKey) || { id: boardKey, boardId: boardKey, name: boardKey };
    state.page = page;
    const searchParams = options.searchParams || state.searchParams || {};
    state.searchParams = searchParams;
    if (!fromHistory) updateURL();
    screenEl.innerHTML = '<div class="loading">연결하는 중 입니다...</div>';
    const data = await loadPosts(boardKey, page, searchParams);
    if (data.board) {
      const resolvedKey = String(getBoardKey(data.board) || boardKey).trim();
      state.board = { ...state.board, ...data.board, id: resolvedKey, boardId: resolvedKey };
      if (!hasExplicitMenuPath) {
        const resolvedMenuPath = String(data.board.menuPath || state.boardMenuPath || 'top').trim() || 'top';
        // [LOG: 20260421_1645] 직접 /board/... 진입 시 보드 메타 기준으로 상위 메뉴 문맥을 복원한다.
        if (typeof loadMenuTree === 'function') {
          await loadMenuTree();
        }
        state.boardMenuPath = resolvedMenuPath;
        state.boardMenuTitle = hasExplicitMenuTitle ? options.menuTitle : getBoardSelectTitle(resolvedMenuPath);
      }
    }
    let displayTitle = state.boardMenuTitle;
    if (searchParams.lt) displayTitle += ` [제목검색: ${searchParams.lt}]`;
    if (searchParams.li) displayTitle += ` [작성자검색: ${searchParams.li}]`;
    
    // [LOG: 20260426_1450] Evolve Mode: Sequential rendering for post list
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildPostListAnsi(state.board, state.posts, state.page, state.totalPages, state.totalCount, displayTitle, searchParams),
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });
    
    renderPostHotspots(rendered.screenNode, state.posts);
    const footerAssetPath = String(state.board?.footerFile || '').trim();
    await applyCommandFooter(
      footerAssetPath,
      getSupportedFooterText(state) || getCommandFooterText('postList'),
      footerAssetPath ? 'txt/cmd_board_footer.txt' : ''
    );
    // [LOG: 20260424_2020] 모바일에서 게시판 목록 진입 시 키보드 자동 팝업 방지
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      cmdInput.focus();
    }
  }

  return { showPostList };
}
