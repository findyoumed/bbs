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
    if (editor.stage === 'title') {
      return editor.mode === 'edit' ? '제목 (Enter=보존) >>' : '제목 >>';
    }
    if (editor.stage === 'keyword_1') return '검색어 1 >>';
    if (editor.stage === 'keyword_2') return '검색어 2 >>';
    if (editor.stage === 'keyword_3') return '검색어 3 >>';
    if (editor.stage === 'body' && typeof editor.editIndex === 'number' && editor.editIndex <= editor.bodyLines.length) {
      return `[${editor.editIndex}번줄 수정(Enter=보존)] >>`;
    }
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

  // [LOG: 20260724_1517] PC통신(BBS) 스타일 폼 에디터 최종 튜닝
  // 화살표키(ArrowUp, ArrowDown)로 제목과 본문 간 자유 이동 및 텍스트 수정 제공.
  // 에뮬레이터 폰트(BbsPrimaryFont, Sam3KRFont), 크기(17px), 행간(1.4)을 100% 동일하게 강제하여 터미널과 완벽한 일체감 제공.
  function renderBbsEditor(editor, onSave, onCancel) {
    editor.stage = 'bbs-form';
    const boardCode = String(state.board?.id || state.board?.boardId || 'BBS').toUpperCase();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const titleId = 'bbs-ed-title';
    const bodyId  = 'bbs-ed-body';

    // PC통신 단말기 스타일 에디터 레이아웃
    const sep = '─'.repeat(76);
    const headerLine = editor.selectedHeader
      ? `<div style="padding:1px 0;opacity:0.8;font-family:inherit;">[ 머리말 : ${editor.selectedHeader} ]</div>`
      : '';

    // 터미널과 100% 동일한 폰트, 자간, 행간, 색상 스타일 상속
    const inputStyle = `
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff !important;
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      letter-spacing: inherit !important;
      outline: none;
      padding: 0;
      margin: 0;
      min-width: 0;
    `;

    // [LOG_ID: 20260725_1312] 게시글 수정/작성 에디터 본문 textarea 상하 높이를 남은 세로 공간 전체(100%)로 확장하여 유연하게 채움
    // [LOG_ID: 20260725_1725] 위 min-height:14em이 부모(.min-height:4.4em, 20260725_1710)와
    // 무관하게 독자적인 하한선으로 작동해, 모바일 키보드로 부모가 눌려도 textarea는 14em 아래로
    // 못 줄어들고 부모 밖으로 넘쳐 다음 형제(하단 안내문구)와 겹쳐 보였다(배경이 transparent라
    // 두 텍스트가 그대로 비쳐 보임 — 사용자 스크린샷: "다"/"라" 타이핑 줄과 "저장: Ctrl+S..." 겹침).
    // min-height를 0으로 낮춰 flex:1/height:100%만으로 남은 공간에 맞게 자연스럽게 줄어들도록 한다
    // (공간이 넉넉한 데스크톱/키보드 없음 상황에서는 flex:1이 이미 넉넉하게 채워주므로 체감 차이 없음).
    const textareaStyle = `
      width: 100%;
      height: 100%;
      min-height: 0;
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff !important;
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      letter-spacing: inherit !important;
      outline: none;
      padding: 0;
      margin: 0;
      resize: none;
    `;

    // [LOG_ID: 20260725_1710] 모바일 키보드가 뜨면 #terminal-screen이 크게 줄어드는데, 이 폼의
    // "내용:" 구획(flex:1; min-height:0)이 그 압박을 받아 실제로 0에 가깝게 짜부라진다. 그 안의
    // "내 용 :" 라벨은 flex-shrink:0이라 줄어들지 않고 원래 크기로 그려지는데, 부모가 그만한
    // 공간을 확보하지 못한 채 다음 형제(하단 안내문구, 역시 flex-shrink:0)가 바로 이어 배치되면서
    // 두 텍스트가 같은 자리에 겹쳐 그려졌다(사용자 스크린샷: "내 용 :"과 "상하화살표/Tab:이동..."이
    // 겹쳐 보임). "내용:" 구획에 라벨 한 줄 + 최소 몇 줄 분량의 바닥을 보장해 0까지 짜부라지지
    // 않게 하고, 그래도 전체가 안 맞으면(아주 작은 키보드 여유 공간) 짜부라뜨리는 대신 바깥
    // 래퍼 전체가 스크롤되도록 한다.
    const bodyHtml = `
<div style="display:flex;flex-direction:column;height:100%;overflow-y:auto;min-height:0;font-family:inherit;font-size:inherit;line-height:inherit;color:#ffffff !important;background:transparent;box-sizing:border-box;">
  <div style="display:flex;align-items:center;padding:2px 0;gap:0;flex-shrink:0;">
    <span style="white-space:nowrap;user-select:none;color:#ffffff !important;font-family:inherit;">제 목 :&nbsp;</span>
    <input id="${titleId}" type="text" autocomplete="off" spellcheck="false" style="${inputStyle}"/>
  </div>
  <div style="color:#555;font-size:inherit;line-height:inherit;letter-spacing:0;white-space:pre;user-select:none;margin:2px 0;flex-shrink:0;">${sep}</div>
  ${headerLine}
  <div style="display:flex;flex-direction:column;flex:1;margin-top:4px;min-height:4.4em;">
    <div style="color:#ffffff !important;padding-bottom:4px;user-select:none;font-family:inherit;flex-shrink:0;">내 용 :</div>
    <textarea id="${bodyId}" spellcheck="false" autocomplete="off" style="${textareaStyle}"></textarea>
  </div>
  <div style="color:#ffffff !important;font-size:inherit !important;border-top:1px dashed #333;padding:4px 0;white-space:normal;word-break:keep-all;overflow-wrap:break-word;user-select:none;font-family:inherit;flex-shrink:0;">
    저장: Ctrl+S 또는 마지막 줄에 . 후 Enter
  </div>
</div>`;

    renderRawHtmlScreenWithTopbar({ leftLabel: boardCode, centerLabel: editor.modeLabel, bodyHtml, screenEl, isMobile });

    const titleEl = document.getElementById(titleId);
    const bodyEl  = document.getElementById(bodyId);
    if (!titleEl || !bodyEl) return;

    // 값 할당
    titleEl.value = editor.title || '';
    bodyEl.value  = editor.bodyLines.join('\n');

    // [LOG_ID: 20260725_1212] 선택>> 프롬프트 행은 에디터 진입 후에도 항상 노출 유지
    // — 탭키로 제목→본문→선택>> 이동이 가능하므로 숨기면 내비게이션이 불가능해짐.
    const promptRow = document.getElementById('terminal-prompt-row');
    if (promptRow) promptRow.style.display = '';
    if (cmdInput) cmdInput.style.display = '';

    editor._textareaActive = true;
    setHint(getWriteHintText());

    function cleanup() {
      editor._textareaActive = false;
      editor._saving = false;
      titleEl.disabled = false;
      bodyEl.disabled = false;
      if (promptRow) {
        promptRow.style.display = '';
      }
      if (cmdInput) {
        cmdInput.style.display = '';
      }
      titleEl.removeEventListener('keydown', onTitleKey);
      bodyEl.removeEventListener('keydown', onBodyKey);
      if (cmdInput) {
        cmdInput.removeEventListener('keydown', onCmdKey);
      }
    }

    // [LOG_ID: 20260725_1420] 종전엔 저장(Ctrl+S) 누르자마자 cleanup()을 먼저 실행해 숨겨뒀던
    // 공용 명령창(cmdInput)/프롬프트 줄을 곧바로 되살리고 포커스까지 줬는데, 그 뒤 onSave()(실제
    // createPost/updatePost API 호출)는 await 없이 fire-and-forget으로만 던졌다. 그래서 저장 요청이
    // 서버 응답을 기다리는 그 짧은 틈에 cmdInput이 이미 살아있어, 그 사이 들어온 입력이 글쓰기 화면
    // 전용 라우팅(state._terminalInputHandler)으로 안전하게 흡수되지 못하고 — 저장이 그새 완료돼
    // 핸들러가 지워졌다면 — 엉뚱하게 전역 명령(Q/X/EXIT 등 종료 확인)으로 처리되는 경쟁 상태가
    // 있었다(사용자 보고 스크린샷: 글쓰기 화면 그대로인데 힌트/프롬프트만 "종료가 취소되었습니다."로
    // 덮어써짐). onSave()가 실제로 끝난 뒤에만 cleanup()을 실행해 그 틈을 없앤다. 저장 중 이중 제출도
    // 함께 막는다.
    function doSave() {
      if (editor._saving) return;
      editor._saving = true;
      const titleVal = titleEl.value.trim();
      const lines = bodyEl.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1].trim() === '.') lines.pop();
      editor.title = titleVal;
      editor.bodyLines = lines;
      titleEl.disabled = true;
      bodyEl.disabled = true;
      Promise.resolve(onSave()).finally(cleanup);
    }

    function isOnFirstLine(ta) {
      return ta.value.substring(0, ta.selectionStart).indexOf('\n') === -1;
    }

    function onTitleKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        bodyEl.focus();
        bodyEl.setSelectionRange(0, 0);
        return;
      }
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        bodyEl.focus();
        bodyEl.setSelectionRange(0, 0);
      }
    }

    function onBodyKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (cmdInput) {
          cmdInput.focus();
          cmdInput.select();
        }
        return;
      }
      if ((e.key === 'ArrowUp' && isOnFirstLine(bodyEl)) || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        titleEl.focus();
        titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
        return;
      }
      if (e.key === 'Enter') {
        const pos = bodyEl.selectionStart;
        const before = bodyEl.value.substring(0, pos);
        const currentLine = before.split('\n').pop().trim();
        if (currentLine === '.') { e.preventDefault(); doSave(); return; }
      }
    }

    function onCmdKey(e) {
      if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
        e.preventDefault();
        bodyEl.focus();
        bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length);
        return;
      }
    }

    titleEl.addEventListener('keydown', onTitleKey);
    bodyEl.addEventListener('keydown', onBodyKey);
    if (cmdInput) {
      cmdInput.addEventListener('keydown', onCmdKey);
    }
    editor._textareaCleanup = cleanup;

    // [LOG_ID: 20260725_1007] 신규 작성/수정 상관없이 글쓰기 에디터 진입 시 첫 포커스는 제목(titleEl)에 위치
    // [LOG_ID: 20260725_1212] hidePromptRow() 호출 제거 — 선택>> 항상 노출 유지
    // [LOG_ID: 20260725_1226] 라우터의 cmdInput 자동 포커스를 덮어쓰기 위해 setTimeout 사용
    setTimeout(() => {
      if (titleEl) {
        titleEl.focus();
        titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
      }
    }, 10);
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
    setHint('저장:. 또는 /s·S  취소:/q 또는 P  목록:/l  수정:/e[번호]  삭제:/d[번호]  삽입:/i[번호]');
  }

  function clearPostWriteEditor() {
    if (state._postWriteEditor?._textareaCleanup) {
      try { state._postWriteEditor._textareaCleanup(); } catch (e) {}
    }
    const promptRow = document.getElementById('terminal-prompt-row');
    if (promptRow) promptRow.style.display = '';
    if (cmdInput) cmdInput.style.display = '';

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
    // [LOG: 20260724_1517] 제목 단계도 BBS 에디터 적용
    renderBbsEditor(editor, editor._onSave, editor._onCancel);
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
    // [LOG: 20260724_1517] 본문 단계도 BBS 에디터 적용
    renderBbsEditor(editor, editor._onSave, editor._onCancel);
  }

  function isCancelWriteCommand(raw) {
    const input = String(raw || '').trim();
    const upper = input.toUpperCase();
    return input === '/q' || upper === 'P' || upper === 'M' || upper === 'B';
  }

  // [LOG_ID: 20260724_0020] 하이텔 등 원전 PC통신 라인 에디터의 관례 — 본문 입력 중 한 줄에
  // 마침표(.)만 찍으면 그 자리에서 글쓰기를 마친다(사용자 확인: "pc통신의 글쓰기가 그렇게
  // 되어있던데"). "." 하나로만 이루어진 줄은 실제 본문으로 쓸 일이 거의 없어 안전하게 구분된다.
  function isSaveWriteCommand(raw) {
    const input = String(raw || '').trim();
    return input === '/s' || input === '.' || input.toUpperCase() === 'S';
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
    if (mode === 'create') {
      state.post = null;
    } else if ((mode === 'edit' || mode === 'reply') && activePost) {
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
    const targetPostId = activePost
      ? ((activePost.localId !== undefined && activePost.localId !== null) ? activePost.localId : activePost.id)
      : null;

    // [LOG: 20260724_1405] _onSave / _onCancel 을 editor에 저장해
    // enterBodyStage → renderTextareaEditor 에서 사용한다.
    const editor = {
      bodyLines: bodyVal ? String(bodyVal).split(/\r?\n/) : [],
      headerOptions,
      mode,
      modeLabel,
      selectedHeader: parsedTitle.selectedHeader || '',
      stage: headerOptions.length ? 'header' : 'title',
      title: titleVal,
      transcript: [],
      targetPost: activePost,
      targetPostId,
      _onSave: async () => handleWriteSubmit(handlers),
      _onCancel: () => cancelPostWrite(handlers)
    };

    renderInitialTranscript(editor);
    state._postWriteEditor = editor;
    // [LOG: 20260509_1115] Post writing uses the shared terminal prompt as a PC통신 line editor.
    const handlePostWriteLine = async (raw) => {
      const activeEditor = getWriteEditorState();
      if (!activeEditor || state.screen !== 'post-write') return false;
      const line = String(raw || '');

      // [LOG_ID: 20260725_1745] 20260725_1735에서 "인식 못한 입력"만 걸렀는데, 저장(S)/취소
      // (P·M·B)처럼 "인식하는" 입력도 여기(raw cmdInput 경로)로 들어오면 여전히 문제였다 —
      // 예를 들어 cmdInput에서 'S'를 치면 곧장 handlers.handleWriteSubmit()을 호출하는데,
      // 이 경로는 editor.title/bodyLines를 titleEl/bodyEl의 실제 입력값으로 동기화하는
      // doSave()를 거치지 않는다. 그래서 화면엔 제목을 이미 "test"라고 써놨는데도 editor.title은
      // 여전히 비어 있는 옛 값이라 "제목을 입력하십시오."가 떴다(사용자 보고: "제목입력했는데
      // 입력하라고 나오네"). 박스 에디터(stage: 'bbs-form')는 저장·취소 모두 titleEl/bodyEl에
      // 직접 물린 keydown 핸들러(Ctrl+S, Esc, 마지막 줄 ".")로만 하게 되어 있으므로, 이 raw
      // 줄 단위 경로 자체를 이 단계에서는 통째로 비활성화한다 — 저장이든 취소든 무엇이든 무시.
      if (activeEditor.stage === 'bbs-form') {
        return true;
      }

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
        // [LOG: 20260724_1505] 수정 모드일 때 빈 엔터 입력 시 기존 제목 보존
        const title = line.trim() || activeEditor.title;
        appendTranscriptLine(activeEditor, line);
        if (!title) {
          appendTranscriptLine(activeEditor, '제목을 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }
        const wasPreserved = !line.trim() && activeEditor.mode === 'edit';
        activeEditor.title = title;
        appendTranscriptLine(activeEditor, `제목: ${title}${wasPreserved ? ' (보존)' : ''}`);
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

      // [LOG: 20260724_1505] 본문 단계 순차 대화형 수정 모드 처리
      if (activeEditor.stage === 'body' && typeof activeEditor.editIndex === 'number' && activeEditor.editIndex <= activeEditor.bodyLines.length) {
        if (isCancelWriteCommand(line)) {
          clearPostWriteEditor();
          handlers.cancelPostWrite();
          return true;
        }
        if (isSaveWriteCommand(line)) {
          // 자료실(pds) 신규 글 작성 시 키워드 단계 예외 적용
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

        const idx = activeEditor.editIndex;
        // 빈 엔터 입력 시 기존 라인 보존, 글자 입력 시 그 줄 내용 교체
        if (!line) {
          appendTranscriptLine(activeEditor, `${idx}: ${activeEditor.bodyLines[idx - 1]} (보존)`);
        } else {
          activeEditor.bodyLines[idx - 1] = line;
          appendTranscriptLine(activeEditor, `${idx}: ${line} (수정)`);
        }

        activeEditor.editIndex++;

        if (activeEditor.editIndex <= activeEditor.bodyLines.length) {
          appendTranscriptLine(activeEditor, `[${activeEditor.editIndex}번 줄] ${activeEditor.bodyLines[activeEditor.editIndex - 1]}`);
        } else {
          activeEditor.editIndex = null;
          appendTranscriptLine(activeEditor, '');
          appendTranscriptLine(activeEditor, '--- 본문 수정 완료. 이어서 추가 입력하십시오 ---');
          appendTranscriptLine(activeEditor, '본문을 입력하십시오. (저장 . 또는 /s·S, 취소 /q 또는 P/M/B)');
          appendTranscriptLine(activeEditor, '줄 수정 /e 번호, 줄 삭제 /d 번호[-번호], 줄 삽입 /i 번호, 줄 목록 /l');
          appendTranscriptLine(activeEditor, '');
          appendNumberedBody(activeEditor);
          appendTranscriptLine(activeEditor, '');
        }
        renderLineEditor(activeEditor);
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

      // [LOG: 20260724_1400] 수정 모드에서 숫자만 입력하면 /e 번호로 자동 처리 (편의 개선)
      const bareNumber = !lineCommand && activeEditor.mode === 'edit' && /^\d+$/.test(line.trim())
        ? Number(line.trim())
        : null;
      const effectiveCommand = lineCommand || (bareNumber ? { type: 'edit', index: bareNumber } : null);

      if (effectiveCommand) {
        appendTranscriptLine(activeEditor, line);

        if (effectiveCommand.type === 'invalid') {
          appendTranscriptLine(activeEditor, effectiveCommand.reason);
          renderLineEditor(activeEditor);
          return true;
        }

        if (effectiveCommand.type === 'list') {
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

        if (effectiveCommand.type === 'edit') {
          if (effectiveCommand.index > activeEditor.bodyLines.length) {
            appendTranscriptLine(activeEditor, `${effectiveCommand.index}번 줄이 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          activeEditor.pendingLineOp = { type: 'edit', index: effectiveCommand.index };
          appendTranscriptLine(activeEditor, `현재 ${effectiveCommand.index}번 줄: ${activeEditor.bodyLines[effectiveCommand.index - 1]}`);
          appendTranscriptLine(activeEditor, '새 내용을 입력하십시오.');
          renderLineEditor(activeEditor);
          return true;
        }

        if (effectiveCommand.type === 'insert') {
          if (effectiveCommand.index > activeEditor.bodyLines.length + 1) {
            appendTranscriptLine(activeEditor, `${effectiveCommand.index}번 줄 앞에 넣을 수 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          activeEditor.pendingLineOp = { type: 'insert', index: effectiveCommand.index };
          appendTranscriptLine(activeEditor, `${effectiveCommand.index}번 줄 앞에 넣을 내용을 입력하십시오.`);
          renderLineEditor(activeEditor);
          return true;
        }

        if (effectiveCommand.type === 'delete') {
          if (effectiveCommand.from > activeEditor.bodyLines.length) {
            appendTranscriptLine(activeEditor, `${effectiveCommand.from}번 줄이 없습니다. (현재 ${activeEditor.bodyLines.length}줄)`);
            renderLineEditor(activeEditor);
            return true;
          }
          const to = Math.min(effectiveCommand.to, activeEditor.bodyLines.length);
          const removed = activeEditor.bodyLines.splice(effectiveCommand.from - 1, to - effectiveCommand.from + 1);
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
      // (stage: 'bbs-form'은 함수 맨 위에서 이미 걸러진다 — 이 아래는 옛 줄 단위 에디터 전용 폴백)
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

    // [LOG: 20260724_1517] header 없으면 직접 BBS 에디터 진입, 있으면 헤더 선택 화면 먼저
    if (!editor.headerOptions.length) {
      renderBbsEditor(editor, editor._onSave, editor._onCancel);
    } else {
      renderLineEditor(editor);
      cmdInput?.focus();
    }
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
    const editorTargetId = editor?.targetPostId;
    const stateTargetId = state.post ? ((state.post.localId !== undefined && state.post.localId !== null) ? state.post.localId : state.post.id) : null;
    const postId = editorTargetId ?? stateTargetId;
    const storedTitle = buildStoredTitle(title, selectedHeader, headerOptions);

    if (state.writeMode === 'edit' && state.post && !canEditPost(state.post)) {
      setHint(UI_TEXT.POST_EDIT_MY_ONLY);
      setPrompt('>>');
      return;
    }

    try {
      const payload = { title: storedTitle, content: body };
      const currentMode = state.writeMode;
      if (currentMode === 'edit' && postId) {
        await updatePost(boardId, postId, payload);
      } else if (currentMode === 'reply' && postId) {
        await replyPost(boardId, postId, payload);
      } else {
        await createPost(boardId, payload);
      }

      clearPostWriteEditor();

      if (currentMode === 'edit' && postId && handlers.showPostView) {
        state.post = null;
        await handlers.showPostView(boardId, postId, false);
      } else {
        state.posts = null;
        await showPostList(boardId, state.page, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      }
    } catch (e) {
      setHint(`저장 실패: ${e.message}`);
    } finally {
      clearPostWriteEditor();
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
