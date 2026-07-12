import { UI_TEXT } from './i18n.js';

/**
 * commandRouterBrowse.js
 * [LOG: 20260426_2120] Evolution Mode: Integrated i18n and replaced unicode escapes.
 */

export function createBrowseCommandHandler(deps) {
  const {
    deletePost,
    doLogout,
    executeMenuNodeAction,
    getMenuChildren,
    getMenuNodeByKey,
    getBoardSelectTitle,
    getMenuNodeKey,
    getMenuNodeTitle,
    getMenuParentKey,
    resolveMenuNodeTarget,
    setHint,
    setPrompt,
    showBoardSelect,
    showLogin,
    showMain,
    showPostList,
    showPostView,
    showPostWrite,
    showToast,
    state,
    showPtPrepare,
    showPtResult
  } = deps;

  function resolveVisiblePostTarget(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
      return null;
    }

    const posts = Array.isArray(state.posts) ? state.posts : [];
    const byPostId = posts.find((post) => String(post?.id || '').trim() === value);
    if (byPostId) {
      return byPostId;
    }

    const rowNumber = parseInt(value, 10);
    if (rowNumber >= 1 && posts[rowNumber - 1]) {
      return posts[rowNumber - 1];
    }

    return null;
  }

  function canManagePost(post) {
    if (!post || !state.user || state.user.isGuest) {
      return false;
    }
    return state.user.isAdmin || state.user.userId === (post.authorUserId || post.userId);
  }

  function beginDeleteConfirm(post) {
    state._deleteConfirmStage = {
      boardId: state.board?.id,
      postId: post.id,
      postTitle: post.title || '',
      page: state.page,
      menuPath: state.boardMenuPath,
      menuTitle: state.boardMenuTitle,
      searchParams: { ...(state.searchParams || {}) },
      returnScreen: 'post-list'
    };
    setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${post.title || post.id}`);
    setPrompt(`${UI_TEXT.POST_DELETE_CONFIRM} (Y/N) [Y]:`);
  }

  async function restoreDeleteConfirmList(deleteStage) {
    await showPostList(deleteStage.boardId, deleteStage.page, {
      menuPath: deleteStage.menuPath,
      menuTitle: deleteStage.menuTitle,
      searchParams: { ...(deleteStage.searchParams || {}) }
    });
  }

  return async function handleBrowseCommand({ s, input, cmd, rawCmd, context }) {
    // [LOG_ID: 20260712_2200] PT 가상 화면 입출력 바인딩
    if (s === 'pt-prepare') {
      if (typeof showPtResult === 'function') {
        await showPtResult();
      }
      return true;
    }
    if (s === 'pt-view') {
      await showPostList(state.board.id, state.page, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: state.searchParams
      });
      return true;
    }

    if (s === 'main') {
      const visibleEntries = Array.isArray(state.boardMenuEntries) && state.boardMenuEntries.length
        ? state.boardMenuEntries
        : getMenuChildren(getMenuNodeByKey('top') || state.menuTree);
      const node = resolveMenuNodeTarget(rawCmd, visibleEntries);
      if (await executeMenuNodeAction(node, state.boardMenuPath, state.boardMenuTitle)) { return true; }
      if (cmd === 'LOGIN' && state.user?.isGuest) { showLogin(); return true; }
      if (cmd === 'P' || cmd === 'M' || cmd === 'B' || cmd === 'T') { await showMain(); return true; }
      if (cmd === 'Q' && !state.user?.isGuest) { await doLogout(); await showMain(); return true; }
      // [LOG: 20260509_1138] Let unhandled main-screen input fall through so global commands like H/C/PERF still run.
      return false;
    }

    if (s === 'board-select') {
      if (cmd === 'B' || cmd === 'P' || cmd === 'M') {
        const parentKey = getMenuParentKey(state.boardMenuPath);
        if (!parentKey || parentKey === 'top') {
          await showMain();
        } else {
          await showBoardSelect(parentKey, getBoardSelectTitle(parentKey));
        }
        return true;
      }
      if (cmd === 'T') { await showMain(); return true; }

      const node = resolveMenuNodeTarget(rawCmd, state.boardMenuEntries);
      if (await executeMenuNodeAction(node, state.boardMenuPath, state.boardMenuTitle)) { return true; }
      // [LOG: 20260509_1138] Let unhandled menu input fall through to global command handlers.
      return false;
    }

    if (s === 'post-list') {
      if (state._deleteConfirmStage) {
        const deleteStage = state._deleteConfirmStage;
        const textInput = String(input || '').trim();
        const normalizedInput = String(rawCmd || '').trim().toUpperCase();

        if (!textInput || normalizedInput === 'Y' || normalizedInput === 'YES') {
          state._deleteConfirmStage = null;
          if (typeof deletePost !== 'function') {
            setHint(`${UI_TEXT.ERROR}: deletePost handler is not available.`);
            setPrompt('>>');
            return true;
          }
          try {
            await deletePost(deleteStage.boardId, deleteStage.postId);
            await restoreDeleteConfirmList(deleteStage);
            showToast?.(UI_TEXT.POST_DELETE_SUCCESS, 2000, 'success');
          } catch (error) {
            setHint(`${UI_TEXT.ERROR}: ${error.message}`);
            setPrompt('>>');
          }
          return true;
        }

        if (normalizedInput === 'N' || normalizedInput === 'NO') {
          state._deleteConfirmStage = null;
          await restoreDeleteConfirmList(deleteStage);
          return true;
        }

        setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${deleteStage.postTitle || deleteStage.postId}`);
        setPrompt(`${UI_TEXT.POST_DELETE_CONFIRM} (Y/N) [Y]:`);
        return true;
      }

      if (cmd === 'P' || cmd === 'M') {
        if (state.boardMenuPath && state.boardMenuPath !== 'top') {
          await showBoardSelect(state.boardMenuPath, state.boardMenuTitle || getBoardSelectTitle(state.boardMenuPath));
        } else {
          await showMain();
        }
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'L') {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: {}
        });
        return true;
      }
      if (cmd === 'F' && state.page < state.totalPages) {
        await showPostList(state.board.id, state.page + 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        });
        return true;
      }
      if (cmd === 'B' && state.page > 1) {
        await showPostList(state.board.id, state.page - 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        });
        return true;
      }
      if (cmd === 'W') {
        // [LOG: 20260429_0258] Route list-screen write through postWriteView's
        // shared guard so guest users get the same login-required hint as direct /board/.../write.
        showPostWrite('create');
        return true;
      }

      const ltMatch = cmd.match(/^LT\s+(.+)$/);
      if (ltMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { lt: ltMatch[1].trim() }
        });
        return true;
      }

      const liMatch = cmd.match(/^LI\s+(.+)$/);
      if (liMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { li: liMatch[1].trim() }
        });
        return true;
      }

      if (cmd === 'LT' || cmd === 'LI') {
        state._pendingSearch = {
          type: cmd.toLowerCase(),
          boardId: state.board.id,
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        };
        setHint(cmd === 'LT' ? UI_TEXT.SEARCH_TITLE_PROMPT : UI_TEXT.SEARCH_AUTHOR_PROMPT);
        setPrompt(cmd === 'LT' ? UI_TEXT.SEARCH_KEYWORD : UI_TEXT.SEARCH_AUTHOR_ID);
        return true;
      }

      const editMatch = rawCmd.match(/^(?:E|ED|EDIT)\s+(.+)$/);
      if (editMatch) {
        if (state.user?.isGuest) {
          setHint(UI_TEXT.LOGIN_REQUIRED);
          setPrompt('>>');
          return true;
        }

        const targetPost = resolveVisiblePostTarget(editMatch[1]);
        if (!targetPost) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }
        if (!canManagePost(targetPost)) {
          setHint(UI_TEXT.POST_EDIT_MY_ONLY);
          setPrompt('>>');
          return true;
        }
        showPostWrite('edit', targetPost);
        return true;
      }

      const deleteMatch = rawCmd.match(/^(?:D|DD)\s+(.+)$/);
      if (deleteMatch) {
        if (state.user?.isGuest) {
          setHint(UI_TEXT.LOGIN_REQUIRED);
          setPrompt('>>');
          return true;
        }

        const targetPost = resolveVisiblePostTarget(deleteMatch[1]);
        if (!targetPost) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }
        if (!canManagePost(targetPost)) {
          setHint(UI_TEXT.POST_DELETE_MY_ONLY);
          setPrompt('>>');
          return true;
        }

        beginDeleteConfirm(targetPost);
        return true;
      }

      // [LOG_ID: 20260712_2200] PT [번호] 제목 100건 일괄 출력 연출 복원
      const ptMatch = cmd.match(/^PT(?:\s+(\d+))?$/);
      if (ptMatch) {
        const startNum = ptMatch[1] ? parseInt(ptMatch[1], 10) : 1;
        if (typeof showPtPrepare === 'function') {
          await showPtPrepare(startNum);
          return true;
        }
      }

      // [LOG_ID: 20260711_1340] PR [번호] 연속읽기 — olddos-bbs(hanulso) 원작 명령 복원.
      // 해당 글부터 열고, 이후 post-view에서 빈 엔터로 다음 글을 이어서 읽는다.
      // [LOG_ID: 20260712_2210] 하이텔 원전 스펙(길라잡이 p.136) 확장: 'PR 번호1-번호2'(범위)와
      // 'PR 번호1,번호2,...'(나열, 최대 10건)를 지원한다. 지정 집합은 큐(_continuousRead.queue)에
      // 담아 빈 엔터마다 순서대로 열고, 소진되면 연속읽기를 마친다. 현재 목록(state.posts)에 있는
      // 글만 대상이며 범위는 번호 오름차순(옛 글부터)으로 순회한다.
      const prMatch = cmd.match(/^PR(?:\s+([\d,\s-]+))?$/);
      if (prMatch) {
        const spec = String(prMatch[1] || '').trim();
        let targets = [];

        const rangeMatch = spec.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          const low = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          const high = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          targets = state.posts
            .filter((post) => { const id = parseInt(post.id, 10); return id >= low && id <= high; })
            .sort((left, right) => parseInt(left.id, 10) - parseInt(right.id, 10))
            .slice(0, 10);
        } else if (spec.includes(',')) {
          const ids = spec.split(',').map((token) => token.trim()).filter(Boolean).slice(0, 10);
          targets = ids
            .map((idToken) => state.posts.find((post) => String(post.id) === idToken))
            .filter(Boolean);
        } else if (spec) {
          const single = state.posts.find((post) => String(post.id) === spec)
            || state.posts[parseInt(spec, 10) - 1];
          if (single) targets = [single];
        } else {
          targets = state.posts.length ? [state.posts[0]] : [];
        }

        if (!targets.length) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }

        const [first, ...rest] = targets;
        state._continuousRead = {
          boardId: state.board.id,
          queue: rest.map((post) => post.id)
        };
        await showPostView(state.board.id, first.id);
        setHint(rest.length
          ? `연속읽기(${targets.length}건): [엔터] 다음 글 · 다른 명령 입력 시 종료`
          : '연속읽기: [엔터] 다음 글 · 다른 명령 입력 시 종료');
        return true;
      }

      const byPostId = state.posts.find((post) => String(post.id) === rawCmd);
      if (byPostId) { await showPostView(state.board.id, byPostId.id); return true; }

      const n = parseInt(rawCmd, 10);
      if (n >= 1 && state.posts[n - 1]) { await showPostView(state.board.id, state.posts[n - 1].id); return true; }

      return false;
    }

    return false;
  };
}
