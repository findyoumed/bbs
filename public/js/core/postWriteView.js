import { UI_TEXT } from './i18n.js';
import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
// [LOG_ID: 20260729_0120] isCancelWriteCommand/isSaveWriteCommand는 이 화면의 라인 에디터가
// 받는 원본 텍스트 줄을 그대로 비교한다 — 전역 normalizeCommand()의 두벌식 자모 보정을 거치지
// 않는다. contactSysopScreen.js/memoScreens.js에서 이미 고친 것과 동일한 헬퍼를 board 글쓰기
// (가장 많이 쓰이는 화면)에도 적용한다.
import { convertKoreanToEnglish } from './commandNormalizer.js';

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
  // [LOG_ID: 20260713_1110] 자료실(PDS) 신규 글/답글 작성 시 검색용 키워드 3개를 받는 기능.
  // [LOG_ID: 20260726_1745] 이 판정 로직과 수집한 키워드를 본문 꼬리에 붙이는 형식("* 검색 키워드 :
  // kw1 / kw2 / kw3")은 옛 줄 단위 에디터(handlePostWriteLine의 keyword_1/2/3 스테이지, 지금은
  // 'bbs-form'이 항상 먼저 걸려 도달 불가능한 죽은 코드)에만 있었다 — 박스 에디터(renderBbsEditor)
  // 저장 경로(_onSave → handleWriteSubmit)는 이 스테이지를 전혀 몰라 곧장 제목+본문만 저장했다.
  // 즉 에디터가 줄 단위 → 박스 형태로 바뀐 뒤로 PDS 검색 키워드 수집 기능 자체가 조용히
  // 사문화되어 있었다(사용자 요청 "PDS 업로드/다운로드 전체 플로우 전수조사"로 발견). 3단계
  // 순차 프롬프트를 그대로 되살리는 대신, 박스 에디터 안에 한 줄짜리 입력창을 추가해 공백으로
  // 구분한 키워드 3개를 한 번에 받는다(기존보다 나은 UX, 결과 형식은 원본과 동일하게 유지).
  function isPdsKeywordBoard(mode) {
    const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
    return isPds && mode !== 'edit';
  }

  function renderBbsEditor(editor, onSave, onCancel) {
    editor.stage = 'bbs-form';
    const boardCode = String(state.board?.id || state.board?.boardId || 'BBS').toUpperCase();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const titleId = 'bbs-ed-title';
    const bodyId  = 'bbs-ed-body';
    const keywordId = 'bbs-ed-keyword';
    const showKeywordField = isPdsKeywordBoard(editor.mode);

    // PC통신 단말기 스타일 에디터 레이아웃
    // [LOG_ID: 20260726_1245] 데스크톱(80컬럼) 기준 76칸 구분선이 모바일(44컬럼)에서도
    // 그대로 그려져 white-space:pre 특성상 줄바꿈되지 않고 컨테이너 밖으로 밀려나가
    // overflow-x:hidden에 잘려 보이지 않게 잘렸다(scrollWidth 570 vs clientWidth 390 확인).
    // 모바일 레이아웃 컬럼수(44)에 맞춰 여백을 제외한 40칸으로 축소.
    const sep = '─'.repeat(isMobile ? 40 : 76);
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
    const keywordRow = showKeywordField
      ? `<div style="display:flex;align-items:center;padding:2px 0;gap:0;flex-shrink:0;">
    <span style="white-space:nowrap;user-select:none;color:#ffffff !important;font-family:inherit;">키워드 :&nbsp;</span>
    <input id="${keywordId}" type="text" autocomplete="off" spellcheck="false" placeholder="검색용 키워드 3개, 공백으로 구분" style="${inputStyle}"/>
  </div>`
      : '';

    // [LOG_ID: 20260727_1125] 서버(BoardRepositoryShared.js MAX_TITLE_LENGTH=60)가 제목을 60자로
    // 자르는데 이 입력창엔 그 제한이 전혀 없었다 — 60자를 넘겨 저장해도 아무 경고 없이 뒷부분이
    // 조용히 잘려나갔다(실측: 84자 입력 → 정확히 60자로 잘려 저장, 힌트에 어떤 안내도 없음).
    // 머리말이 있는 게시판은 저장 시 "[머리말] " 접두어가 이 필드 뒤에(정확히는 앞에) 더 붙으므로,
    // 그만큼 여유를 뺀 값을 한도로 준다 — 안 그러면 머리말 접두어 때문에 총 길이가 60을 넘어
    // 같은 문제가 재발한다.
    const titleMaxLength = Math.max(1, 60 - (editor.selectedHeader ? editor.selectedHeader.length + 3 : 0));
    const bodyHtml = `
<div style="display:flex;flex-direction:column;height:100%;overflow-y:auto;min-height:0;font-family:inherit;font-size:inherit;line-height:inherit;color:#ffffff !important;background:transparent;box-sizing:border-box;">
  <div style="display:flex;align-items:center;padding:2px 0;gap:0;flex-shrink:0;">
    <span style="white-space:nowrap;user-select:none;color:#ffffff !important;font-family:inherit;">제 목 :&nbsp;</span>
    <input id="${titleId}" type="text" autocomplete="off" spellcheck="false" maxlength="${titleMaxLength}" style="${inputStyle}"/>
  </div>
  ${keywordRow}
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
    const keywordEl = showKeywordField ? document.getElementById(keywordId) : null;
    if (!titleEl || !bodyEl) return;

    // 값 할당
    // [LOG_ID: 20260727_1145] 위 titleMaxLength(maxlength 속성)는 사용자가 직접 타이핑할 때만
    // 막아준다 — 답글(reply) 모드는 "Re: " + 원글 제목을 여기서 .value로 그대로 밀어넣는데,
    // 원글 제목이 이미 60자에 가까우면 "Re: " 4자가 더해져 60자를 넘는다. .value 대입은
    // maxlength의 영향을 받지 않으므로(브라우저가 사용자 타이핑만 제한) 그 초과분이 화면엔
    // 그대로 보이다가 저장 시 서버가 다시 말없이 잘라냈다(실측 재현: 60자 원글에 답글 →
    // 저장된 답글 제목이 64자가 아니라 60자로 조용히 잘림 — 위 20260727_1127과 같은 버그
    // 클래스가 다른 경로로 재발). 대입 시점에 직접 잘라 입력창에 보이는 값과 실제 저장될
    // 값이 항상 일치하게 한다.
    titleEl.value = String(editor.title || '').slice(0, titleMaxLength);
    bodyEl.value  = editor.bodyLines.join('\n');
    if (keywordEl) keywordEl.value = (editor.keywords || []).join(' ');

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
      if (keywordEl) {
        keywordEl.disabled = false;
        keywordEl.removeEventListener('keydown', onKeywordKey);
      }
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
      // [LOG_ID: 20260726_1745] PDS 신규 글/답글은 저장 전 키워드 3개(공백 구분)를 검증한다 —
      // 옛 줄 단위 에디터의 keyword_1/2/3 스테이지가 정확히 3개를 요구했던 것과 동일한 기준.
      let keywordParts = null;
      if (keywordEl) {
        keywordParts = keywordEl.value.trim().split(/\s+/).filter(Boolean);
        if (keywordParts.length !== 3) {
          setHint('자료 검색용 키워드를 공백으로 구분해 정확히 3개 입력하십시오.');
          keywordEl.focus();
          return;
        }
      }
      editor._saving = true;
      const titleVal = titleEl.value.trim();
      const lines = bodyEl.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1].trim() === '.') lines.pop();
      if (keywordParts) {
        editor.keywords = keywordParts;
        lines.push('', `* 검색 키워드 : ${keywordParts.join(' / ')}`);
      }
      editor.title = titleVal;
      editor.bodyLines = lines;
      titleEl.disabled = true;
      bodyEl.disabled = true;
      if (keywordEl) keywordEl.disabled = true;
      // [LOG_ID: 20260727_0900] onSave()(handleWriteSubmit)가 실패하면 이제 false를 돌려준다 —
      // 그 경우 cleanup()(키다운 리스너 제거·에디터 파기)을 부르지 않고 필드만 다시 활성화해,
      // 사용자가 방금 쓴 제목/본문을 그대로 두고 Ctrl+S로 바로 재시도할 수 있게 한다. 성공했을
      // 때만 정리한다(위 20260725_1420이 막던 경쟁 상태는 이 경우에도 여전히 없다 — cleanup은
      // onSave가 실제로 끝난 뒤에만 호출된다).
      const releaseFields = () => {
        editor._saving = false;
        titleEl.disabled = false;
        bodyEl.disabled = false;
        if (keywordEl) keywordEl.disabled = false;
      };
      Promise.resolve(onSave())
        .then((succeeded) => {
          if (succeeded === false) {
            releaseFields();
            return;
          }
          cleanup();
        })
        .catch(() => releaseFields());
    }

    function isOnFirstLine(ta) {
      return ta.value.substring(0, ta.selectionStart).indexOf('\n') === -1;
    }

    // [LOG_ID: 20260726_1745] 키워드 입력창이 있으면(PDS 신규 글/답글) 제목→키워드→본문 순으로,
    // 없으면 기존과 동일하게 제목→본문 순으로 이동한다.
    function focusFieldAfterTitle() {
      const target = keywordEl || bodyEl;
      target.focus();
      if (target === bodyEl) bodyEl.setSelectionRange(0, 0);
      else target.select();
    }

    function onTitleKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        focusFieldAfterTitle();
      }
    }

    function onKeywordKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape')         { e.preventDefault(); cleanup(); onCancel(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        bodyEl.focus();
        bodyEl.setSelectionRange(0, 0);
        return;
      }
      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        titleEl.focus();
        titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
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
        if (keywordEl) {
          keywordEl.focus();
          keywordEl.select();
        } else {
          titleEl.focus();
          titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
        }
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
    if (keywordEl) {
      keywordEl.addEventListener('keydown', onKeywordKey);
    }
    if (cmdInput) {
      cmdInput.addEventListener('keydown', onCmdKey);
    }
    editor._textareaCleanup = cleanup;
    // [LOG_ID: 20260727_0645] handlePostWriteLine의 'bbs-form' 분기가 cmd-input을 통해 실행할 수
    // 있도록 실제 저장/취소 로직을 editor에 노출한다 — doSave()는 titleEl/bodyEl의 현재 값을
    // editor.title/bodyLines로 동기화한 뒤 저장하므로, 이 클로저 안의 doSave를 그대로 재사용해야
    // 값 동기화 없이 빈 내용을 저장하는 사고를 막을 수 있다.
    editor._doSave = doSave;
    editor._doCancel = () => { cleanup(); onCancel(); };

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

  // [LOG_ID: 20260729_0120] 한/영 전환이 안 된 채 물리 P/M/B/S 키를 치면 두벌식 자판상
  // 'ㅔ'/'ㅡ'/'ㅠ'/'ㄴ'으로 들어온다 — 그 결과가 알려진 명령과 일치할 때만 그 명령으로
  // 인정한다(자유 문장은 음절이 2글자 이상이라 오작동 위험 없음). contactSysopScreen.js/
  // memoScreens.js와 동일한 헬퍼.
  function toKoreanCommandToken(raw) {
    const trimmed = String(raw || '').trim();
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(trimmed) ? convertKoreanToEnglish(trimmed).toUpperCase() : '';
  }

  function isCancelWriteCommand(raw) {
    const input = String(raw || '').trim();
    const upper = input.toUpperCase();
    const koCmd = toKoreanCommandToken(input);
    return input === '/q' || upper === 'P' || upper === 'M' || upper === 'B'
      || koCmd === '/Q' || koCmd === 'P' || koCmd === 'M' || koCmd === 'B';
  }

  // [LOG_ID: 20260724_0020] 하이텔 등 원전 PC통신 라인 에디터의 관례 — 본문 입력 중 한 줄에
  // 마침표(.)만 찍으면 그 자리에서 글쓰기를 마친다(사용자 확인: "pc통신의 글쓰기가 그렇게
  // 되어있던데"). "." 하나로만 이루어진 줄은 실제 본문으로 쓸 일이 거의 없어 안전하게 구분된다.
  function isSaveWriteCommand(raw) {
    const input = String(raw || '').trim();
    const koCmd = toKoreanCommandToken(input);
    return input === '/s' || input === '.' || input.toUpperCase() === 'S'
      || koCmd === '/S' || koCmd === 'S';
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
      // 줄 단위 경로 자체를 이 단계에서는 원칙적으로 비활성화한다 — 단, 힌트바(P:취소/S:저장)와
      // Tab 이동(본문→cmd-input)이 여전히 이 입력창에 도달 가능하다고 광고·허용하는 이상, S/P/M/B
      // 만큼은 실제로 동작해야 한다(그렇지 않으면 클릭 가능한 힌트 토큰과 Tab 이동 자체가 눈속임이
      // 된다 — 사용자 보고: "포커스를 이동해서 cmd-input에 입력해도 입력 동작 안한다"). doSave 경로
      // 재사용으로 위 20260725_1745가 막았던 동기화 누락 버그도 재발하지 않는다.
      if (activeEditor.stage === 'bbs-form') {
        if (isSaveWriteCommand(line)) {
          activeEditor._doSave?.();
          return true;
        }
        if (isCancelWriteCommand(line)) {
          activeEditor._doCancel?.();
          return true;
        }
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
      return true;
    } catch (e) {
      // [LOG_ID: 20260727_0900] 예전엔 이 catch 뒤에 무조건 clearPostWriteEditor()를 또 부르는
      // finally가 있었다 — 저장이 실패해도(네트워크 오류·서버 검증 거부 등) 화면엔 방금 쓴
      // 제목/본문이 그대로 남아 있는데 정작 state._postWriteEditor/_terminalInputHandler는
      // 사라져, 재시도(Ctrl+S)도 취소(Esc/P)도 전혀 먹히지 않는 죽은 화면이 됐다(실측 재현:
      // 저장 강제 실패 후 Ctrl+S를 다시 눌러도 API 호출 자체가 발생하지 않음 — 사용자가 쓴 글이
      // 그대로 증발할 위험). 실패 시엔 정리하지 않고 에디터를 살려둬 재시도할 수 있게 한다.
      setHint(`저장 실패: ${e.message}`);
      return false;
    }
  }

  function cancelPostWrite(handlers) {
    const { showPostList, showPostView } = handlers;
    // [LOG_ID: 20260727_1040] handleWriteSubmit()의 저장 성공 경로는 수정(edit) 모드일 때 글보기
    // (showPostView)로 돌아가는데, 취소 경로는 이 구분 없이 언제나 게시판 목록으로만 보냈다 —
    // 글보기 화면에서 E로 수정을 시작했다가 취소하면 방금 읽던 글이 아니라 엉뚱하게 목록으로
    // 튕겨나갔다(실측 재현). 성공/취소가 같은 곳으로 돌아가도록 맞춘다. 새 글 작성(create)과
    // 답글(reply)은 성공 시에도 원래부터 목록으로 가므로(답글은 목록에서 스레드로 바로 보임)
    // 그대로 둔다.
    const editor = getWriteEditorState();
    const isEditingExistingPost = editor?.mode === 'edit' && editor.targetPostId != null;
    const boardId = state.board?.id;
    clearPostWriteEditor();
    if (isEditingExistingPost && boardId && typeof showPostView === 'function') {
      state.post = null;
      void showPostView(boardId, editor.targetPostId, false);
      return;
    }
    if (state.board) {
      void showPostList(state.board.id, state.page, { menuPath: state.boardMenuPath, menuTitle: state.boardMenuTitle });
      return;
    }
    void showMain();
  }

  return { showPostWrite, handleWriteSubmit, cancelPostWrite };
}
