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
    if (editor.stage === 'keyword_1') return '검색어 1 >>';
    if (editor.stage === 'keyword_2') return '검색어 2 >>';
    if (editor.stage === 'keyword_3') return '검색어 3 >>';
    return '본문 >>';
  }

  // [LOG_ID: 20260710_1640] 본문 입력이 길어지면 transcript가 하단 구분선 아래로 밀려
  // 지금 치는 줄이 화면 밖으로 사라졌다. 화면 본문 높이(약 19행)에 맞춰 마지막 줄들만 보여주고,
  // 잘린 앞부분은 생략 표시 한 줄로 안내한다(PC통신 라인 에디터의 "화면 끝 줄부터 이어쓰기" 방식).
  const MAX_VISIBLE_TRANSCRIPT_LINES = 18;

  function getVisibleTranscriptLines(editor) {
    const lines = editor.transcript;
    if (lines.length <= MAX_VISIBLE_TRANSCRIPT_LINES) {
      return lines;
    }
    const hiddenCount = lines.length - (MAX_VISIBLE_TRANSCRIPT_LINES - 1);
    return [`(... 이전 ${hiddenCount}줄 생략 ...)`, ...lines.slice(hiddenCount)];
  }

  function renderLineEditor(editor) {
    if (!editor) return;
    const transcriptHtml = getVisibleTranscriptLines(editor)
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

  // [LOG_ID: 20260710_1640] getSupportedFooterText()는 "명령 힌트\n선택 >>"처럼 프롬프트 줄까지
  // 포함한 풋터 원문을 돌려준다. 다른 화면은 applyCommandFooter→parseCommandFooter가 힌트/프롬프트를
  // 분리해 쓰는데, 글쓰기 화면은 원문을 통째로 setHint에 넣어 힌트 아래 "선택 >>"가 단계 프롬프트
  // ("제목 >>" 등)와 함께 이중 프롬프트로 표시됐다. 같은 규칙('>>' 포함 줄은 프롬프트)으로 힌트만 쓴다.
  function getWriteHintText() {
    const hintOnly = String(getSupportedFooterText() || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.includes('>>'))
      .join(' ');
    return hintOnly || '저장:S 또는 /s  취소:P/M/B 또는 /q';
  }

  function setBodyEditorHint() {
    setHint(getWriteHintText());
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
    const handlePostWriteLine = async (raw) => {
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

      // [LOG_ID: 20260713_1110] 검색 키워드 1단계 수집
      if (activeEditor.stage === 'keyword_1') {
        activeEditor.keywords = activeEditor.keywords || [];
        const kw = line.trim();
        appendTranscriptLine(activeEditor, line);
        if (!kw) {
          appendTranscriptLine(activeEditor, '검색 키워드를 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        activeEditor.keywords.push(kw);
        appendTranscriptLine(activeEditor, `키워드 1: ${kw}`);
        activeEditor.stage = 'keyword_2';
        renderLineEditor(activeEditor);
        return true;
      }

      // [LOG_ID: 20260713_1110] 검색 키워드 2단계 수집
      if (activeEditor.stage === 'keyword_2') {
        const kw = line.trim();
        appendTranscriptLine(activeEditor, line);
        if (!kw) {
          appendTranscriptLine(activeEditor, '검색 키워드를 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        activeEditor.keywords.push(kw);
        appendTranscriptLine(activeEditor, `키워드 2: ${kw}`);
        activeEditor.stage = 'keyword_3';
        renderLineEditor(activeEditor);
        return true;
      }

      // [LOG_ID: 20260713_1110] 검색 키워드 3단계 수집 및 본문 꼬리 추가
      if (activeEditor.stage === 'keyword_3') {
        const kw = line.trim();
        appendTranscriptLine(activeEditor, line);
        if (!kw) {
          appendTranscriptLine(activeEditor, '검색 키워드를 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        activeEditor.keywords.push(kw);
        appendTranscriptLine(activeEditor, `키워드 3: ${kw}`);
        
        const kLines = activeEditor.keywords.join(' / ');
        activeEditor.bodyLines.push('', `* 검색 키워드 : ${kLines}`);
        
        await handlers.handleWriteSubmit();
        return true;
      }

      if (isSaveWriteCommand(line)) {
        // [LOG_ID: 20260713_1110] 자료실(pds) 신규 글 작성인 경우 저장 전에 검색 키워드 3개 등록 단계를 순차 진행
        const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
        if (isPds && activeEditor.mode !== 'edit') {
          activeEditor.stage = 'keyword_1';
          appendTranscriptLine(activeEditor, '');
          appendTranscriptLine(activeEditor, '자료 검색용 키워드 3개를 순서대로 입력해 주십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
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
    // [LOG_ID: 20260710_1640] raw 터미널 핸들러는 제출 텍스트를 입력창에 유지하는 정책(20260619_1732)이라
    // 핸들러가 직접 지워야 한다. 지우지 않아 머리말 번호가 제목 프롬프트에, 마지막 본문 줄과 저장 명령(S)이
    // 다음 화면 입력창에 그대로 남았다. 각 줄은 transcript에 즉시 echo되므로 잔류 텍스트는 필요 없다.
    state._postWriteInputHandler = async (raw) => {
      const handled = await handlePostWriteLine(raw);
      if (handled && cmdInput && cmdInput.value) {
        cmdInput.value = '';
      }
      return handled;
    };
    state._terminalInputHandler = state._postWriteInputHandler;
    setHint(getWriteHintText());
    // [LOG_ID: 20260710_1640] 진입 즉시 글쓰기 화면을 그린다. 기존에는 renderLineEditor를 첫 입력
    // 처리 때만 호출해서, W/E 직후에도 이전 목록 화면이 그대로 남고 하단 프롬프트만 바뀌어
    // "글쓰기가 안 된다"고 느껴지는 상태였다(첫 줄을 입력해야 비로소 화면이 전환됐다).
    renderLineEditor(editor);
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
    const postId = state.post?.localId ?? state.post?.id;
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
