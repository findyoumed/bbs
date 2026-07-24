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

  // [LOG_ID: 20260724_0010] 본문 단계는 일반 화면의 P/S/H 힌트만으로는 줄 편집 명령(/E, /D, /I,
  // /L)을 알 수 없어, 본문 입력 중에는 이 명령들을 직접 안내하는 전용 힌트를 쓴다.
  function setBodyEditorHint() {
    setHint('저장:/s 또는 S  취소:/q 또는 P  목록:/l  수정:/e[번호]  삭제:/d[번호]  삽입:/i[번호]');
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

  // [LOG_ID: 20260724_0010] 하이텔/천리안/나우누리 책의 라인 에디터 방식 — 줄마다 번호를 매겨
  // 보여주고, "/E 번호"로 그 줄을 바꿔 쓰고 "/D 번호[-번호]"로 지우고 "/I 번호"로 그 줄 앞에
  // 새 줄을 끼워 넣는다(원본 명령 관례를 따라 "/" 접두어로 본문 텍스트와 구분). 사용자 지적—
  // "글쓰기와 글수정이 불편하게 구현되어 있는데" — 이전에는 본문을 한 줄씩 뒤에 追加만 할 수
  // 있었고(특히 글수정은 기존 내용을 절대 고치지 못하고 뒤에 새 줄만 덧붙이는 구조), 어느 줄이
  // 몇 번째인지 알 방법도 없었다.
  function appendNumberedBody(editor) {
    editor.bodyLines.forEach((line, index) => {
      appendTranscriptLine(editor, `${String(index + 1).padStart(3, ' ')}: ${line}`);
    });
  }

  function enterBodyStage(editor) {
    editor.stage = 'body';
    editor.pendingLineOp = null;
    appendTranscriptLine(editor, '');
    appendTranscriptLine(editor, '본문을 입력하십시오. (저장 /s 또는 S, 취소 /q 또는 P/M/B)');
    appendTranscriptLine(editor, '줄 수정 /e 번호, 줄 삭제 /d 번호[-번호], 줄 삽입 /i 번호, 줄 목록 /l');
    if (editor.bodyLines.length) {
      appendTranscriptLine(editor, '');
      appendTranscriptLine(editor, '--- 현재 본문 ---');
      appendNumberedBody(editor);
      appendTranscriptLine(editor, '--- 이어서 입력하거나 위 명령으로 수정하십시오 ---');
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

  // [LOG_ID: 20260724_0010] "/L", "/E 3", "/D 2-4", "/I 5" 형태의 줄 편집 명령을 인식한다.
  // 본문 텍스트가 우연히 "/"로 시작하는 경우와 구분하기 위해, 알려진 편집 명령 글자
  // (L/E/D/I) 형태와 정확히 일치할 때만 명령으로 처리하고, 그 외 "/"로 시작하는 줄은
  // 그대로 본문 텍스트로 취급한다.
  function parseLineCommand(raw) {
    const input = String(raw || '').trim();
    const match = input.match(/^\/([LEDIeldi])\s*(.*)$/);
    if (!match) return null;
    const type = match[1].toUpperCase();
    const rest = match[2].trim();

    if (type === 'L') return { type: 'list' };

    if (type === 'E') {
      const n = Number(rest);
      if (!Number.isInteger(n) || n < 1) return { type: 'invalid', reason: `줄 번호를 지정하십시오. 예) /E 3` };
      return { type: 'edit', index: n };
    }

    if (type === 'I') {
      const n = Number(rest);
      if (!Number.isInteger(n) || n < 1) return { type: 'invalid', reason: `줄 번호를 지정하십시오. 예) /I 3` };
      return { type: 'insert', index: n };
    }

    if (type === 'D') {
      const rangeMatch = rest.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const from = Number(rangeMatch[1]);
        const to = Number(rangeMatch[2]);
        if (from < 1 || to < from) return { type: 'invalid', reason: `줄 범위가 올바르지 않습니다. 예) /D 2-4` };
        return { type: 'delete', from, to };
      }
      const n = Number(rest);
      if (!Number.isInteger(n) || n < 1) return { type: 'invalid', reason: `줄 번호를 지정하십시오. 예) /D 3 또는 /D 2-4` };
      return { type: 'delete', from: n, to: n };
    }

    return null;
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

      // [LOG_ID: 20260724_0010] /E 또는 /I로 지정한 줄의 새 내용을 기다리는 중이면, 이번 입력은
      // 명령이 아니라 그 줄의 실제 텍스트다.
      if (activeEditor.pendingLineOp) {
        const op = activeEditor.pendingLineOp;
        activeEditor.pendingLineOp = null;
        if (isCancelWriteCommand(line)) {
          appendTranscriptLine(activeEditor, line);
          appendTranscriptLine(activeEditor, '입력을 취소했습니다.');
          renderLineEditor(activeEditor);
          return true;
        }
        appendTranscriptLine(activeEditor, line);
        if (op.type === 'edit') {
          activeEditor.bodyLines[op.index - 1] = line;
          appendTranscriptLine(activeEditor, `${op.index}번 줄을 수정했습니다.`);
        } else {
          activeEditor.bodyLines.splice(op.index - 1, 0, line);
          appendTranscriptLine(activeEditor, `${op.index}번 줄 앞에 삽입했습니다.`);
        }
        appendTranscriptLine(activeEditor, '');
        appendNumberedBody(activeEditor);
        appendTranscriptLine(activeEditor, '');
        renderLineEditor(activeEditor);
        return true;
      }

      const lineCommand = parseLineCommand(line);
      if (lineCommand) {
        appendTranscriptLine(activeEditor, line);

        if (lineCommand.type === 'invalid') {
          appendTranscriptLine(activeEditor, lineCommand.reason);
          renderLineEditor(activeEditor);
          return true;
        }

        if (lineCommand.type === 'list') {
          appendTranscriptLine(activeEditor, '');
          if (activeEditor.bodyLines.length) {
            appendNumberedBody(activeEditor);
          } else {
            appendTranscriptLine(activeEditor, '(아직 입력한 줄이 없습니다)');
          }
          appendTranscriptLine(activeEditor, '');
          renderLineEditor(activeEditor);
          return true;
        }

        if (lineCommand.type === 'edit') {
          if (lineCommand.index > activeEditor.bodyLines.length) {
            appendTranscriptLine(activeEditor, `${lineCommand.index}번 줄이 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          activeEditor.pendingLineOp = { type: 'edit', index: lineCommand.index };
          appendTranscriptLine(activeEditor, `현재 ${lineCommand.index}번 줄: ${activeEditor.bodyLines[lineCommand.index - 1]}`);
          appendTranscriptLine(activeEditor, '새 내용을 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }

        if (lineCommand.type === 'insert') {
          if (lineCommand.index > activeEditor.bodyLines.length + 1) {
            appendTranscriptLine(activeEditor, `${lineCommand.index}번 줄 앞에 넣을 수 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          activeEditor.pendingLineOp = { type: 'insert', index: lineCommand.index };
          appendTranscriptLine(activeEditor, `${lineCommand.index}번 줄 앞에 넣을 내용을 입력하십시오.`);
          renderLineEditor(activeEditor);
          return true;
        }

        if (lineCommand.type === 'delete') {
          if (lineCommand.from > activeEditor.bodyLines.length) {
            appendTranscriptLine(activeEditor, `${lineCommand.from}번 줄이 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          const to = Math.min(lineCommand.to, activeEditor.bodyLines.length);
          const removed = activeEditor.bodyLines.splice(lineCommand.from - 1, to - lineCommand.from + 1);
          appendTranscriptLine(activeEditor, `${removed.length}줄을 삭제했습니다.`);
          appendTranscriptLine(activeEditor, '');
          if (activeEditor.bodyLines.length) {
            appendNumberedBody(activeEditor);
          } else {
            appendTranscriptLine(activeEditor, '(아직 입력한 줄이 없습니다)');
          }
          appendTranscriptLine(activeEditor, '');
          renderLineEditor(activeEditor);
          return true;
        }
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
