import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

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
    setReady,
    state,
    updateURL,
    renderScreenSequential
  } = deps;

  async function showPostView(boardId, postId, fromHistory = false, requestedPageNo = 1) {
    state.screen = 'post-view';
    state._postNavigation = null;

    const canReuse = state.post
      && String(state.board?.id || '').trim() === String(boardId).trim()
      && String(state.post.localId ?? state.post.id) === String(postId);

    if (!fromHistory) updateURL();

    if (!canReuse) {
      if (!state.post || String(state.post.localId ?? state.post.id) !== String(postId)) {
        state.post = { id: postId, localId: postId };
      }
      setLoading('연결하는 중입니다..');
      const boardKey = String(boardId || '').trim();
      // [LOG_ID: 20260728_1728] PDS 가상 게시판 및 검색 상태의 글보기 내비게이션 복원을 위해 virtualBoardId와 state.searchParams를 함께 연계
      const currentParentId = String(state.board?.id || '').trim();
      const isParentVirtual = currentParentId === 'pds';
      const virtualBoardId = (isParentVirtual && boardKey !== currentParentId) ? currentParentId : '';

      const data = await loadPost(boardKey, postId, virtualBoardId, state.searchParams || {});

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
    }

    // [LOG_ID: 20260708_1300] setReady(true)를 남은 await(loadMenuTree)가 모두 끝난 뒤로 옮긴다.
    // 예전 위치(로딩 타이머 취소 목적)는 그 뒤에 여전히 await가 남아 있어, 그 사이 footer가 먼저
    // 드러나며 구분선/힌트가本문 없이(또는 이전 화면의 낡은 내용인 채) 노출되는 순서 역행을 만들었다.
    // (아래 게시물 없음 조기 반환 경로도 커버하도록 그 분기보다 앞에 둔다.)
    setReady(true);

    if (!state.post) {
      screenEl.innerHTML = '<div class="bbs-box"><div class="bbs-error">게시물을 불러올 수 없습니다.</div></div>';
      return;
    }
    const canEdit = state.user && !state.user.isGuest && (state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId));
    const isGuest = !state.user || state.user.isGuest;
    
    // [LOG: 20260426_1455] Evolve Mode: Sequential rendering for post view
    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const postViewAnsi = buildPostViewAnsi(state.board, state.post, state.totalCount, canEdit, isGuest, state.searchParams || {}, requestedPageNo);
    state.postPageNo = postViewAnsi.pageNo;
    state.postPageCount = postViewAnsi.pageCount;

    await renderAnsiScreenWithTopbarSequential({
      ansiText: postViewAnsi.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('txt/cmd_article_footer.txt', getSupportedFooterText(state) || getCommandFooterText('postView'));
      }
    });

    // [LOG: 20260424_2020] 모바일에서 게시물 보기 진입 시 키보드 자동 팝업 방지
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  // [LOG_ID: 20260726_1800] PDS 같은 병합 가상 게시판은 local_id가 하위 게시판별로 독립
  // 채번돼 서로 다른 하위 게시판에서 값이 겹칠 수 있다 — 이미 로드된 목록 항목(post.boardId)이
  // 있는 경로는 그 값을 그대로 써서 정확한 글을 연다. 서버가 준 _postNavigation.nextId/prevId는
  // local_id뿐이라 여기선 병합 별칭을 쓸 수밖에 없는데, 서버측 fetchPostByLocalId가 이제
  // 충돌 시에도 조회 실패 대신 하나를 결정적으로 골라 응답하도록 완화되어 있다.
  async function showAdjacentPost(direction, handlers) {
    const { showPostList } = handlers;
    const currentPosts = Array.isArray(state.posts) ? state.posts : [];
    const idx = currentPosts.findIndex((p) => String(p.id) === String(state.post?.id));
    if (idx >= 0) {
      const next = currentPosts[idx + direction];
      if (next) { await showPostView(next.boardId || state.board.id, next.localId ?? next.id); return true; }
    }
    const navigationTargetId = direction > 0 ? state._postNavigation?.nextId : state._postNavigation?.prevId;
    if (navigationTargetId) {
      await showPostView(state.board.id, navigationTargetId);
      return true;
    }
    if (direction > 0 && state.page < state.totalPages) {
      await showPostList(state.board.id, state.page + 1, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      if (state.posts[0]) { await showPostView(state.posts[0].boardId || state.board.id, state.posts[0].localId ?? state.posts[0].id); return true; }
    }
    if (direction < 0 && state.page > 1) {
      await showPostList(state.board.id, state.page - 1, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      if (state.posts.length) {
        const last = state.posts[state.posts.length - 1];
        await showPostView(last.boardId || state.board.id, last.localId ?? last.id);
        return true;
      }
    }
    return false;
  }

  return { showPostView, showAdjacentPost };
}
