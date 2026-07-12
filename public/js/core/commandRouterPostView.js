import { UI_TEXT } from './i18n.js';

/**
 * commandRouterPostView.js
 * [LOG: 20260426_2125] Evolution Mode: Integrated i18n and replaced unicode escapes.
 */

export function createPostViewCommandHandler(deps) {
  const {
    deletePost,
    recommendPost,
    restoreStateFromURL,
    setHint,
    setPrompt,
    showAdjacentPost,
    showMain,
    showPostList,
    showPostView,
    showPostWrite,
    showAttachmentList,
    downloadAttachment,
    state
  } = deps;

  return async function handlePostViewCommand({ cmd, context }) {
    if (state.screen !== 'post-view' && state.screen !== 'attachment-list') {
      return false;
    }

    if (state.screen === 'attachment-list') {
      if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
        await showPostView(state.board.id, state.post.id);
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      const idx = parseInt(cmd, 10);
      if (idx >= 1 && state._attachments?.[idx - 1]) {
        const file = state._attachments[idx - 1];
        await downloadAttachment(state.board.id, state.post.id, file.id, file.originalFilename || file.filename);
        return true;
      }
      return false;
    }

    // [LOG_ID: 20260711_1340] PR 연속읽기 — olddos-bbs(hanulso) 원작 명령 복원.
    // 모드 중 빈 엔터는 다음 글로 이동, 마지막 글이면 모드를 마친다.
    // A/N(인접 글 이동)과 빈 엔터 외의 명령을 입력하면 모드가 풀린다.
    const continuousRead = state._continuousRead
      && String(state._continuousRead.boardId) === String(state.board?.id);
    if (continuousRead && cmd === '') {
      if (state._continuousRead.queue && state._continuousRead.queue.length > 0) {
        const nextId = state._continuousRead.queue.shift();
        await showPostView(state.board.id, nextId);
        if (state._continuousRead.queue.length > 0) {
          setHint(`연속읽기(남은글 ${state._continuousRead.queue.length}건): [엔터] 다음 글 · 다른 명령 입력 시 종료`);
        } else {
          setHint('연속읽기: [엔터] 다음 글(마지막) · 다른 명령 입력 시 종료');
        }
        return true;
      }

      if (await showAdjacentPost(1)) {
        setHint('연속읽기: [엔터] 다음 글 · 다른 명령 입력 시 종료');
      } else {
        state._continuousRead = null;
        setHint('마지막 글입니다. 연속읽기를 마칩니다.');
        setPrompt('선택 >>');
      }
      return true;
    }
    if (cmd === 'PR') {
      state._continuousRead = { boardId: state.board.id };
      setHint('연속읽기: [엔터] 다음 글부터 이어서 보여줍니다.');
      return true;
    }
    if (state._continuousRead && cmd !== '' && cmd !== 'A' && cmd !== 'N') {
      state._continuousRead = null;
    }

    if (cmd === 'T') {
      await showMain();
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

    if (cmd === 'P' || cmd === 'M' || cmd === 'B') {
      await showPostList(state.board.id, state.page, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: state.searchParams
      });
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

    if (cmd === 'A' || cmd === ']') {
      if (await showAdjacentPost(1)) {
        return true;
      }
    }
    if (cmd === 'N' || cmd === '[') {
      if (await showAdjacentPost(-1)) {
        return true;
      }
    }

    if (cmd === 'RE' || cmd === 'R') {
      // [LOG: 20260429_0239] Keep reply auth parity in one place so guest users
      // get the same login-required hint as direct /board/.../write restores.
      showPostWrite('reply', state.post);
      return true;
    }

    // [LOG: 20260429_0328] Detail-view auth-guarded commands must fail closed
    // so guest E/D inputs reuse the same login-required hint path as R/V.
    const isGuestUser = !state.user || state.user.isGuest;

    if (cmd === 'ED' || cmd === 'E' || cmd === 'EDIT') {
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      const canEdit = state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId);
      if (canEdit) {
        showPostWrite('edit', state.post);
      } else {
        setHint(UI_TEXT.POST_EDIT_MY_ONLY);
      }
      return true;
    }

    if (cmd === 'OK' || cmd === 'V') {
      // [LOG: 20260429_0229] `V` is documented as login-required, so guest users
      // must stay on the current post and see the same login hint as other guarded flows.
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      await recommendPost(state.board.id, state.post.id);
      await showPostView(state.board.id, state.post.id);
      return true;
    }

    if (cmd === 'DD' || cmd === 'D') {
      if (isGuestUser) {
        setHint(UI_TEXT.LOGIN_REQUIRED);
        return true;
      }
      const canDelete = state.user.isAdmin || state.user.userId === (state.post.authorUserId || state.post.userId);
      if (canDelete) {
        const confirmed = await deps.showConfirm(UI_TEXT.POST_DELETE_CONFIRM);
        if (confirmed) {
          try {
            await deletePost(state.board.id, state.post.id);
            await showPostList(state.board.id, state.page, {
              menuPath: state.boardMenuPath,
              menuTitle: state.boardMenuTitle,
              searchParams: { ...(state.searchParams || {}) }
            });
            deps.showToast?.(UI_TEXT.POST_DELETE_SUCCESS, 2000, 'success');
          } catch (error) {
            setHint(`${UI_TEXT.ERROR}: ${error.message}`);
          }
        }
      } else {
        setHint(UI_TEXT.POST_DELETE_MY_ONLY);
      }
      return true;
    }

    if (cmd === 'U') {
      await showAttachmentList(state.board.id, state.post.id);
      return true;
    }

    return false;
  };
}
