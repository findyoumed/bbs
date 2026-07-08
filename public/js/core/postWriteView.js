import { UI_TEXT } from './i18n.js';
import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';

export function createPostWriteView(deps) {
  const {
    cmdInput, createPost, esc, getSupportedFooterText, replyPost,
    screenEl, setHint, setPrompt, showMain, state, updatePost, updateURL
  } = deps;

  function getPostHeaderOptions(board, mode = 'create', refPost = null) {
    const options = Array.isArray(board?.postHeaders)
      ? board.postHeaders.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!options.length || mode === 'reply') {
      return [];
    }
    if (mode === 'edit' && Number(refPost?.step || 0) > 0) {
      return [];
    }
    return options;
  }

  function parsePrefixedTitle(title, options) {
    const rawTitle = String(title || '').trim();
    for (const option of options) {
      const prefix = `[${option}]`;
      if (rawTitle === prefix) {
        return { selectedHeader: option, plainTitle: '' };
      }
      if (rawTitle.startsWith(`${prefix} `)) {
        return {
          selectedHeader: option,
          plainTitle: rawTitle.slice(prefix.length + 1).trimStart()
        };
      }
    }
    return { selectedHeader: '', plainTitle: rawTitle };
  }

  // [LOG: 20260422_0920] Plaza stores merged board categories as title prefixes.
  function buildStoredTitle(title, selectedHeader, options) {
    const nextTitle = String(title || '').trim();
    if (!selectedHeader || !options.includes(selectedHeader)) {
      return nextTitle;
    }
    return `[${selectedHeader}] ${nextTitle}`;
  }

  function canEditPost(refPost = null) {
    const targetPost = refPost || state.post;
    return Boolean(
      state.user
      && !state.user.isGuest
      && (state.user.isAdmin || state.user.userId === (targetPost?.authorUserId || targetPost?.userId))
    );
  }

  function getWriteEditorState() {
    return state._postWriteEditor || null;
  }

  function appendTranscriptLine(editor, line = '') {
    editor.transcript.push(String(line || ''));
  }

  function getWritePrompt(editor) {
    if (!editor) return '>>';
    if (editor.stage === 'header') return '머리말 번호/이름 >>';
    if (editor.stage === 'title') return '제목 >>';
    return '본문 >>';
  }

  function renderLineEditor(editor) {
    if (!editor) return;
    const transcriptHtml = editor.transcript
      .map((line) => `<div class="ansi-line">${esc(line)}</div>`)
      .join('');
    const boardCode = String(state.board?.id || state.board?.boardId || 'BBS').toUpperCase();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // [LOG_ID: 20260708_1030] 다른 화면과 동일한 정통 상단바로 렌더링한다.
    // (기존엔 상단바 없이 .bbs-box 제목 줄만 있어 글쓰기 화면만 로고 박스·실시간 시계가 빠져 있었다.)
    renderRawHtmlScreenWithTopbar({
      leftLabel: boardCode,
      centerLabel: editor.modeLabel,
      bodyHtml: transcriptHtml,
      screenEl,
      isMobile
    });
    setPrompt(getWritePrompt(editor));
  }

  function setBodyEditorHint() {
    setHint(getSupportedFooterText() || '저장:S 또는 /s  취소:P/M/B 또는 /q');
  }

  function clearPostWriteEditor() {
    if (state._terminalInputHandler === state._postWriteInputHandler) {
      state._terminalInputHandler = null;
    }
    state._postWriteInputHandler = null;
    state._postWriteEditor = null;
  }

  function resolveHeaderSelection(editor, raw) {
    const input = String(raw || '').trim();
    if (!input && editor.selectedHeader) {
      return editor.selectedHeader;
    }
    const numeric = Number(input);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= editor.headerOptions.length) {
      return editor.headerOptions[numeric - 1];
    }
    return editor.headerOptions.find((option) => option.toLowerCase() === input.toLowerCase()) || '';
  }

  function renderInitialTranscript(editor) {
    appendTranscriptLine(editor, editor.modeLabel);
    appendTranscriptLine(editor, '');

    if (editor.headerOptions.length) {
      appendTranscriptLine(editor, '머리말을 선택하십시오.');
      editor.headerOptions.forEach((option, index) => {
        appendTranscriptLine(editor, `${index + 1}. ${option}`);
      });
      if (editor.selectedHeader) appendTranscriptLine(editor, `현재: ${editor.selectedHeader}`);
      appendTranscriptLine(editor, '');
      return;
    }

    appendTranscriptLine(editor, '제목을 입력하십시오.');
    if (editor.title) appendTranscriptLine(editor, `현재: ${editor.title}`);
    appendTranscriptLine(editor, '');
  }

  function enterTitleStage(editor) {
    editor.stage = 'title';
    appendTranscriptLine(editor, '');
    appendTranscriptLine(editor, '제목을 입력하십시오.');
    if (editor.title) appendTranscriptLine(editor, `현재: ${editor.title}`);
    appendTranscriptLine(editor, '');
    renderLineEditor(editor);
  }

  function enterBodyStage(editor) {
    editor.stage = 'body';
    appendTranscriptLine(editor, '');
    appendTranscriptLine(editor, '본문을 입력하십시오. 저장은 S 또는 /s, 취소는 P/M/B 또는 /q 입니다.');
    if (editor.bodyLines.length) {
      appendTranscriptLine(editor, '');
      appendTranscriptLine(editor, '--- 현재 본문 ---');
      editor.bodyLines.forEach((line) => appendTranscriptLine(editor, line));
      appendTranscriptLine(editor, '--- 이어서 입력 ---');
    }
    appendTranscriptLine(editor, '');
    setBodyEditorHint();
    renderLineEditor(editor);
  }

  function isCancelWriteCommand(raw) {
    const input = String(raw || '').trim();
    const upper = input.toUpperCase();
    return input === '/q' || upper === 'P' || upper === 'M' || upper === 'B';
  }

  function isSaveWriteCommand(raw) {
    const input = String(raw || '').trim();
    return input === '/s' || input.toUpperCase() === 'S';
  }

  function showPostWrite(handlers, mode = 'create', refPost = null) {
    const activePost = refPost
      ? (state.post && String(state.post.id) === String(refPost.id)
        ? { ...state.post, ...refPost }
        : { ...refPost })
      : state.post;
    // [LOG: 20260429_0214] Direct /board/.../write and /board/.../:postId/edit restores
    // must honor the same guest/author guards as the interactive board commands.
    if (!state.user || state.user.isGuest) {
      setHint(UI_TEXT.LOGIN_REQUIRED);
      setPrompt('>>');
      return;
    }
    if (mode === 'create' && state.board?.writeSysopOnly && !state.user?.isAdmin) {
      setHint('이 게시판은 관리자만 글을 쓸 수 있습니다.');
      setPrompt('>>');
      return;
    }
    if (mode === 'reply' && state.board?.replyEnabled === false) {
      setHint('이 게시판은 답글을 지원하지 않습니다.');
      setPrompt('>>');
      return;
    }
    if (mode === 'edit' && !canEditPost(activePost)) {
      setHint(UI_TEXT.POST_EDIT_MY_ONLY);
      setPrompt('>>');
      return;
    }
    // [LOG: 20260429_0312] Visible-row E [번호] list edits must hydrate state.post
    // before the submit path runs so edit submits call updatePost instead of createPost.
    if ((mode === 'edit' || mode === 'reply') && activePost) {
      state.post = activePost;
    }

    state.screen = 'post-write';
    state.writeMode = mode;
    if (updateURL) updateURL(true);

    const headerOptions = getPostHeaderOptions(state.board, mode, activePost);
    const parsedTitle = parsePrefixedTitle(mode === 'edit' ? (activePost?.title || '') : '', headerOptions);
    const titleVal = mode === 'edit'
      ? parsedTitle.plainTitle
      : mode === 'reply'
        ? `Re: ${activePost?.title || ''}`
        : '';
    const bodyVal = mode === 'edit' ? (activePost?.content || activePost?.body || '') : '';
    const modeLabel = mode === 'edit' ? '글 수정' : mode === 'reply' ? '답글 쓰기' : '글 쓰기';
    const editor = {
      bodyLines: bodyVal ? String(bodyVal).split(/\r?\n/) : [],
      headerOptions,
      mode,
      modeLabel,
      selectedHeader: parsedTitle.selectedHeader || '',
      stage: headerOptions.length ? 'header' : 'title',
      title: titleVal,
      transcript: []
    };

    renderInitialTranscript(editor);
    state._postWriteEditor = editor;
    // [LOG: 20260509_1115] Post writing uses the shared terminal prompt as a PC통신 line editor.
    state._postWriteInputHandler = async (raw) => {
      const activeEditor = getWriteEditorState();
      if (!activeEditor || state.screen !== 'post-write') return false;
      const line = String(raw || '');

      if (activeEditor.stage === 'header') {
        if (isCancelWriteCommand(line)) {
          clearPostWriteEditor();
          handlers.cancelPostWrite();
          return true;
        }
        const selectedHeader = resolveHeaderSelection(activeEditor, line);
        appendTranscriptLine(activeEditor, line);
        if (!selectedHeader) {
          appendTranscriptLine(activeEditor, '머리말을 다시 선택하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        activeEditor.selectedHeader = selectedHeader;
        appendTranscriptLine(activeEditor, `선택: ${selectedHeader}`);
        enterTitleStage(activeEditor);
        return true;
      }

      if (activeEditor.stage === 'title') {
        if (isCancelWriteCommand(line)) {
          clearPostWriteEditor();
          handlers.cancelPostWrite();
          return true;
        }
        const title = line.trim() || activeEditor.title;
        appendTranscriptLine(activeEditor, line);
        if (!title) {
          appendTranscriptLine(activeEditor, '제목을 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        activeEditor.title = title;
        appendTranscriptLine(activeEditor, `제목: ${title}`);
        enterBodyStage(activeEditor);
        return true;
      }

      if (isSaveWriteCommand(line)) {
        await handlers.handleWriteSubmit();
        return true;
      }
      if (isCancelWriteCommand(line)) {
        clearPostWriteEditor();
        handlers.cancelPostWrite();
        return true;
      }
      activeEditor.bodyLines.push(line);
      appendTranscriptLine(activeEditor, line);
      renderLineEditor(activeEditor);
      return true;
    };
    state._terminalInputHandler = state._postWriteInputHandler;
    setHint(getSupportedFooterText() || '취소:P/M/B 또는 /q');
    setPrompt(getWritePrompt(editor));
    cmdInput?.focus();
  }

  async function handleWriteSubmit(handlers) {
    const { showPostList } = handlers;
    if (!state.user || state.user.isGuest) {
      setHint(UI_TEXT.LOGIN_REQUIRED);
      setPrompt('>>');
      return;
    }
    const editor = getWriteEditorState();
    const headerOptions = editor?.headerOptions || getPostHeaderOptions(state.board, state.writeMode, state.post);
    const selectedHeader = editor?.selectedHeader || '';
    const title = editor?.title?.trim() || '';
    const body = editor ? editor.bodyLines.join('\n') : '';

    if (headerOptions.length && !selectedHeader) {
      setHint('머리말을 선택하십시오.');
      return;
    }
    if (!title) {
      setHint('제목을 입력하십시오.');
      return;
    }

    const boardId = state.board.id;
    const postId = state.post?.id;
    const storedTitle = buildStoredTitle(title, selectedHeader, headerOptions);

    if (state.writeMode === 'edit' && state.post && !canEditPost(state.post)) {
      setHint(UI_TEXT.POST_EDIT_MY_ONLY);
      setPrompt('>>');
      return;
    }

    try {
      const payload = { title: storedTitle, content: body };
      if (state.writeMode === 'edit' && postId) await updatePost(boardId, postId, payload);
      else if (state.writeMode === 'reply' && postId) await replyPost(boardId, postId, payload);
      else await createPost(boardId, payload);
      clearPostWriteEditor();
      await showPostList(boardId, state.page, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
    } catch (e) {
      setHint(`저장 실패: ${e.message}`);
    }
  }

  function cancelPostWrite(handlers) {
    const { showPostList } = handlers;
    clearPostWriteEditor();
    if (state.board) {
      void showPostList(state.board.id, state.page, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      return;
    }
    void showMain();
  }

  return { showPostWrite, handleWriteSubmit, cancelPostWrite };
}
