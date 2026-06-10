import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

export function createPostViewView(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildPostViewAnsi,
    cmdInput,
    getBoardKey,
    getBoardSelectTitle,
    getCommandFooterText,
    getSupportedFooterText,
    loadMenuTree,
    loadPost,
    screenEl,
    setLoading,
    state,
    updateURL,
    renderScreenSequential
  } = deps;

  async function showPostView(boardId, postId, fromHistory = false) {
    state.screen = 'post-view';
    state._postNavigation = null;
    if (!state.post || String(state.post.id) !== String(postId)) state.post = { id: postId };
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    const boardKey = String(boardId || '').trim();
    const data = await loadPost(boardKey, postId);
    state.post = data.post;
    // [LOG: 20260429_0047] Direct /board/:boardId/:postId entry must keep
    // server-side prev/next information so post-view commands do not depend on a prior list visit.
    state._postNavigation = data.navigation || null;
    if (data.board) {
      const resolvedKey = getBoardKey(data.board) || boardKey;
      state.board = { ...(state.board || {}), ...data.board, id: resolvedKey, boardId: resolvedKey };
      const resolvedMenuPath = String(data.board.menuPath || state.boardMenuPath || 'top').trim() || 'top';
      const needsMenuContextHydration = !String(state.boardMenuTitle || '').trim()
        || String(state.boardMenuPath || '').trim() !== resolvedMenuPath;

      if (needsMenuContextHydration && typeof loadMenuTree === 'function') {
        await loadMenuTree();
      }

      state.boardMenuPath = resolvedMenuPath;
      state.boardMenuTitle = typeof getBoardSelectTitle === 'function'
        ? getBoardSelectTitle(resolvedMenuPath)
        : (String(state.boardMenuTitle || '').trim() || resolvedMenuPath.toUpperCase());
    }
    if (!state.post) {
      screenEl.innerHTML = '<div class="bbs-box"><div class="bbs-error">게시물을 불러올 수 없습니다.</div></div>';
      return;
    }
    const canEdit = state.user && !state.user.isGuest && (state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId));
    const isGuest = !state.user || state.user.isGuest;
    
    // [LOG: 20260426_1455] Evolve Mode: Sequential rendering for post view
    await renderAnsiScreenWithTopbarSequential({
      ansiText: buildPostViewAnsi(state.board, state.post, state.totalCount, canEdit, isGuest, state.searchParams || {}),
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });
    
    await applyCommandFooter('txt/cmd_article_footer.txt', getSupportedFooterText(state) || getCommandFooterText('postView'));
    // [LOG: 20260424_2020] 모바일에서 게시물 보기 진입 시 키보드 자동 팝업 방지
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      cmdInput.focus();
    }
  }

  async function showAdjacentPost(direction, handlers) {
    const { showPostList } = handlers;
    const currentPosts = Array.isArray(state.posts) ? state.posts : [];
    const idx = currentPosts.findIndex((p) => String(p.id) === String(state.post?.id));
    if (idx >= 0) {
      const next = currentPosts[idx + direction];
      if (next) { await showPostView(state.board.id, next.id); return true; }
    }
    const navigationTargetId = direction > 0 ? state._postNavigation?.nextId : state._postNavigation?.prevId;
    if (navigationTargetId) {
      await showPostView(state.board.id, navigationTargetId);
      return true;
    }
    if (direction > 0 && state.page < state.totalPages) {
      await showPostList(state.board.id, state.page + 1, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      if (state.posts[0]) { await showPostView(state.board.id, state.posts[0].id); return true; }
    }
    if (direction < 0 && state.page > 1) {
      await showPostList(state.board.id, state.page - 1, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      if (state.posts.length) { await showPostView(state.board.id, state.posts[state.posts.length - 1].id); return true; }
    }
    return false;
  }

  return { showPostView, showAdjacentPost };
}
