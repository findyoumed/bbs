import { createPostListView } from './postListView.js';
import { createPostViewView } from './postViewView.js';
import { createPostWriteView } from './postWriteView.js';
import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';

export function createPostScreens(deps) {
  const {
    ansiToHTML, apiFetch, applyCommandFooter, buildPostListAnsi, buildPostViewAnsi, buildAttachmentListAnsi,
    cmdInput, createPost, downloadAttachment, esc, findBoardByKey, getBoardKey, getBoardSelectTitle,
    getCommandFooterText, getSupportedFooterText, loadAttachments, loadPost, loadPosts, replyPost,
    screenEl, setLoading, showMain, state, updatePost, updateURL,
    renderScreenSequential
  } = deps;

  const { showPostList, showPtPrepare, showPtResult } = createPostListView({ ...deps, renderScreenSequential });
  const { showPostView, showAdjacentPost } = createPostViewView({ ...deps, renderScreenSequential });
  const { showPostWrite, handleWriteSubmit, cancelPostWrite } = createPostWriteView(deps);

  const handlers = {
    showPostList: (id, p, o, f) => showPostList(id, p, o, f),
    showPostView: (id, pid, f) => showPostView(id, pid, f),
    showPostWrite: (m, r) => showPostWrite(handlers, m, r),
    handleWriteSubmit: () => handleWriteSubmit(handlers),
    cancelPostWrite: () => cancelPostWrite(handlers),
    showAdjacentPost: (d) => showAdjacentPost(d, handlers),
    showPtPrepare: (startNum) => showPtPrepare(startNum),
    showPtResult: () => showPtResult()
  };

  async function showAttachmentList(boardId, postId, fromHistory = false) {
    const resolvedBoardId = String(boardId || state.board?.id || state.board?.boardId || '').trim();
    const resolvedPostId = String(postId || state.post?.id || '').trim();
    state.screen = 'attachment-list';
    if (resolvedBoardId) {
      state.board = { ...(state.board || {}), id: resolvedBoardId, boardId: resolvedBoardId };
    }
    if (resolvedPostId) {
      state.post = { ...(state.post || {}), id: resolvedPostId };
    }
    if (!fromHistory) {
      void updateURL(true);
    }
    setLoading('연결하는 중입니다..');
    const list = await loadAttachments(resolvedBoardId, resolvedPostId); state._attachments = list || [];
    // [LOG_ID: 20260708_1030] renderAnsiScreenWithTopbar로 정통 상단바를 렌더링하고,
    // applyCommandFooter를 거쳐 setReady(true)까지 위임한다. 기존엔 setLoading()만 걸고
    // setReady를 부르지 않아 내부 400ms 로딩 타이머가 취소되지 않고 뒤늦게 발동해
    // 방금 그린 첨부파일 목록을 "연결하는 중입니다"로 영구히 덮어써 버리는 결함이 있었다.
    renderAnsiScreenWithTopbar({ ansiText: buildAttachmentListAnsi(state._attachments), ansiToHTML, screenEl });
    await applyCommandFooter('', getSupportedFooterText(state) || getCommandFooterText('attachmentList'));
  }

  return { ...handlers, showAttachmentList };
}
