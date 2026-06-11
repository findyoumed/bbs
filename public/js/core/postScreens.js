import { createPostListView } from './postListView.js';
import { createPostViewView } from './postViewView.js';
import { createPostWriteView } from './postWriteView.js';

export function createPostScreens(deps) {
  const {
    ansiToHTML, applyCommandFooter, buildPostListAnsi, buildPostViewAnsi, buildAttachmentListAnsi,
    cmdInput, createPost, downloadAttachment, esc, findBoardByKey, getBoardKey, getBoardSelectTitle,
    getCommandFooterText, getSupportedFooterText, loadAttachments, loadPost, loadPosts, replyPost,
    screenEl, setHint, setLoading, setReady, setPrompt, showMain, state, updatePost, updateURL,
    renderScreenSequential
  } = deps;

  const { showPostList } = createPostListView({ ...deps, renderScreenSequential });
  const { showPostView, showAdjacentPost } = createPostViewView({ ...deps, renderScreenSequential });
  const { showPostWrite, handleWriteSubmit, cancelPostWrite } = createPostWriteView(deps);

  const handlers = {
    showPostList: (id, p, o, f) => showPostList(id, p, o, f),
    showPostView: (id, pid, f) => showPostView(id, pid, f),
    showPostWrite: (m, r) => showPostWrite(handlers, m, r),
    handleWriteSubmit: () => handleWriteSubmit(handlers),
    cancelPostWrite: () => cancelPostWrite(handlers),
    showAdjacentPost: (d) => showAdjacentPost(d, handlers)
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
    const rendered = ansiToHTML(buildAttachmentListAnsi(state._attachments));
    screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;
    setHint(getSupportedFooterText(state));
    setPrompt('>>');
  }

  return { ...handlers, showAttachmentList };
}
