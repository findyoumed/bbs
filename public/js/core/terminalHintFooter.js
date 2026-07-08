import { createTerminalHintLayout } from './terminalHintLayout.js';
import { createTerminalHintMarkup } from './terminalHintMarkup.js';
import { displayWidth } from './ansiRenderUtils.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createTerminalHintFooter(deps) {
  const {
    hintEl,
    cmdPromptEl,
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    getOutputListener,
    esc
  } = deps;

  let hintTrimFrame = 0;
  let footerLoadPending = false;
  let footerContentUpdateDepth = 0;
  let promptLayoutFrame = 0;
  // [LOG: 20260611_1524] Store prompts without trailing spaces; CSS owns the one-cell prompt gap.
  const DEFAULT_COMMAND_PROMPT = '선택 >>';
  const terminalFooter = document.getElementById('terminal-footer');
  const promptRowEl = document.getElementById('terminal-prompt-row');
  const cmdPromptRendererEl = document.getElementById('cmd-prompt-renderer');
  const promptRowHome = promptRowEl?.parentElement || null;
  let promptRowPlaceholder = null;
  const { resetHintExpansion, toggleHintExpansion, trimHintEntriesToFit } = createTerminalHintLayout({
    hintEl
  });
  const { renderHintMarkup } = createTerminalHintMarkup({
    state,
    esc
  });

  if (cmdPromptRendererEl && cmdInput) {
    cmdPromptRendererEl.addEventListener('mousedown', (event) => {
      // [LOG: 20260615_1621] Clicking the input-rendered prompt should behave like clicking the old label.
      event.preventDefault();
      if (shouldAutoFocusCommandInput()) cmdInput.focus();
    });
  }

  function scheduleHintTrim(attempt = 0) {
    if (!hintEl || typeof window === 'undefined') {
      return;
    }

    if (hintTrimFrame && attempt === 0) {
      window.cancelAnimationFrame(hintTrimFrame);
    }

    hintTrimFrame = window.requestAnimationFrame(() => {
      hintTrimFrame = 0;
      trimHintEntriesToFit();

      if (
        attempt < 2
        && hintEl.classList.contains('has-cmd-tokens')
        && hintEl.clientWidth <= 0
        && terminalFooter?.dataset.footerState !== 'hidden'
      ) {
        scheduleHintTrim(attempt + 1);
      }
    });
  }

  // [LOG_ID: 20260707_1815] Batch footer content writes so prompt/pending state lands before hint repaint.
  function beginFooterContentUpdate() {
    footerContentUpdateDepth += 1;
  }

  function endFooterContentUpdate() {
    footerContentUpdateDepth = Math.max(0, footerContentUpdateDepth - 1);
  }

  function syncPromptRendererWidth() {
    if (!cmdPromptRendererEl) {
      return;
    }

    // [LOG_ID: 20260707_1652] Re-sync prompt width after font loading and the next paint so the first render matches the focused state.
    // [LOG_ID: 20260708_1725] ch 대신 em을 쓴다. ch는 "현재 적용된 폰트의 숫자 0 글자 폭"이라, CDN
    // 웹폰트(BbsPrimaryFont)가 아직 로드되기 전 폴백 폰트로 렌더링되는 동안에는 이 요소의 폭 자체가
    // 폴백 폰트 기준으로 계산됐다가 폰트 로드 완료 순간 자동으로 재계산되어 살짝 넓어졌다 좁아지는
    // 것처럼 보였다(실측: 17px 기준 폴백 1ch=9px, BbsPrimaryFont 1ch=8.5px=0.5em). em은 폰트 크기에만
    // 비례하고 어떤 폰트가 적용됐는지와 무관하므로, 로딩 중이든 로드 후든 폭이 항상 고정된다.
    const trimmed = String(cmdPromptRendererEl.value || '').trimEnd();
    cmdPromptRendererEl.style.width = `${Math.max(1, displayWidth(trimmed || '')) * 0.5}em`;
  }

  function schedulePromptLayoutSync() {
    if (typeof window === 'undefined' || !cmdPromptRendererEl) {
      return;
    }

    if (promptLayoutFrame) {
      window.cancelAnimationFrame(promptLayoutFrame);
    }

    promptLayoutFrame = window.requestAnimationFrame(() => {
      promptLayoutFrame = 0;
      syncPromptRendererWidth();

      // [LOG_ID: 20260708_1450] 여기서 걸던 50ms 뒤 setFooterVisibility(true) 호출을 제거한다.
      // 이 함수는 setPrompt() 호출마다(즉 화면 콘텐츠 준비 여부와 무관하게), 그리고 최초 부팅 시
      // document.fonts.ready 완료 시점에도 실행되는데 — 후자는 실제 화면(상단바+본문)이 아직 렌더되기
      // 전이라도 무조건 발동한다. 그 결과 footer만 먼저 "visible"로 뒤집혀, 빈 화면 위에 구분선+힌트+
      // 프롬프트가 상단바/본문보다 먼저 나타나는(위→아래 순서 역행) 현상이 부팅 직후 항상 재현됐다.
      // footer의 실제 노출은 이미 content-synchronized 경로(렌더러 자신의 인라인 숨김/해제,
      // core.setReady(true)→setFooterVisibility(true))가 전담하므로 이 폭 재계산 헬퍼가 별도로
      // visibility까지 강제할 필요가 없다 — 폭 재동기화만 남긴다.
      window.setTimeout(() => {
        syncPromptRendererWidth();
      }, 50);
    });
  }

  function setFooterVisibility(isVisible) {
    if (!terminalFooter) {
      return;
    }

    const visible = Boolean(isVisible);
    terminalFooter.dataset.footerState = visible ? 'visible' : 'hidden';
    terminalFooter.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!cmdInput) {
      return;
    }

    cmdInput.disabled = !visible;
    if (!visible && document.activeElement === cmdInput) {
      cmdInput.blur();
      return;
    }

    if (visible) {
      scheduleHintTrim();
    }
  }

  function syncScreenContext() {
    const screenName = String(state.screen || '').trim();
    if (typeof document === 'undefined') {
      return;
    }

    // [LOG: 20260507_1757] Keep /myinfo edit prompts in the footer so the active input stays at the bottom.
    restorePromptRow();

    if (document.body) {
      if (screenName) {
        document.body.dataset.screen = screenName;
      } else {
        delete document.body.dataset.screen;
      }
    }

    const container = document.getElementById('terminal-container');
    if (container) {
      if (screenName) {
        container.dataset.screen = screenName;
      } else {
        delete container.dataset.screen;
      }
    }
  }

  function ensurePromptRowPlaceholder() {
    if (!promptRowEl || !promptRowHome || promptRowPlaceholder) {
      return;
    }

    promptRowPlaceholder = document.createComment('terminal-prompt-row-home');
    promptRowHome.insertBefore(promptRowPlaceholder, promptRowEl);
  }

  function mountPromptRow(targetEl) {
    if (!promptRowEl || !targetEl) {
      return;
    }

    ensurePromptRowPlaceholder();
    targetEl.appendChild(promptRowEl);
    promptRowEl.classList.add('terminal-prompt-row--inline');
    terminalFooter?.classList.add('terminal-footer--prompt-detached');

    if (cmdInput) {
      cmdInput.disabled = false;
      window.setTimeout(() => {
        if (document.activeElement !== cmdInput) {
          if (shouldAutoFocusCommandInput()) cmdInput.focus();
        }
      }, 0);
    }
  }

  function restorePromptRow() {
    if (!promptRowEl || !promptRowHome) {
      return;
    }

    if (promptRowEl.parentElement !== promptRowHome) {
      if (promptRowPlaceholder?.parentNode === promptRowHome) {
        promptRowHome.insertBefore(promptRowEl, promptRowPlaceholder);
      } else {
        promptRowHome.appendChild(promptRowEl);
      }
    }

    promptRowEl.classList.remove('terminal-prompt-row--inline');
    terminalFooter?.classList.remove('terminal-footer--prompt-detached');

    if (cmdInput && !cmdInput.disabled) {
      window.setTimeout(() => {
        if (document.activeElement !== cmdInput) {
          if (shouldAutoFocusCommandInput()) cmdInput.focus();
        }
      }, 0);
    }
  }

  function setHint(text) {
    syncScreenContext();

    const outputListener = typeof getOutputListener === 'function' ? getOutputListener() : null;
    if (outputListener) {
      outputListener(text);
    }

    if (hintEl) {
      resetHintExpansion();
      const markup = renderHintMarkup(text);
      hintEl.innerHTML = markup;
      hintEl.classList.toggle('has-cmd-tokens', markup.includes('cmd-token'));
      trimHintEntriesToFit();
      scheduleHintTrim();

      const isLoadingScreen = Boolean(
        screenEl?.parentElement?.classList.contains('is-loading')
        || screenEl?.classList.contains('is-loading')
      );

      if (
        text
        && terminalFooter?.dataset.footerState === 'hidden'
        && !footerLoadPending
        && footerContentUpdateDepth === 0
        && !isLoadingScreen
      ) {
        setFooterVisibility(true);
      }
    }

    // [LOG_ID: 20260708_0940] "힌트가 비면 로딩 중이다"라는 추론으로 #terminal-container/#terminal-screen에
    // is-loading을 켜고 끄던 레거시 로직을 제거한다. setHint('')는 로딩 전환 이외에도 정상적인 상태 변화
    // (대화실 미인식 슬래시 명령 무음 처리, 내정보 비밀번호/이메일/탈퇴 단계 전환 등)에서 광범위하게
    // 호출되는데, 이 추론은 그런 호출 이후에도 is-loading이 계속 켜진 채로 남아(다음 화면 전환 전까지
    // 해제할 방법이 없음) 커스텀 커서가 영구히 숨겨지고 입력줄이 클릭 불가 상태로 고착되는 버그를 냈다
    // (myinfo 모드 초기화(resetMyInfoState→'view') 뒤의 setHint('') 다수, 대화실 "/xyz" 같은 미인식 명령 등).
    // 로딩 상태는 이미 명시적 API인 setLoading()/setReady()/setBusy()가 각자 정리 경로(15초 가디언 타이머,
    // applyCommandFooter의 finally)와 함께 전담하므로 이 추론은 불필요하며 제거해도 로딩 표시는 그대로 동작한다.
  }

  function setPrompt(text) {
    const promptText = (text === undefined || text === null || text === '>>')
      ? (state.envVars?.PROMPT || DEFAULT_COMMAND_PROMPT)
      : String(text);

    if (cmdInput) {
      const useMaskedInput = Boolean(state._maskCommandInput);
      // [LOG_ID: 20260624_0925] type="password"를 사용하면 일부 브라우저에서 투명색 처리를 무시하고
      // 기본 동그라미(bullet)를 강제로 그려서 커스텀 별(*) 모양과 겹쳐 보이는 현상이 발생함.
      // 텍스트 보안은 JS의 * 렌더링 및 CSS(color: transparent)로 처리하므로 type="text"로 고정함.
      cmdInput.type = 'text';
      cmdInput.dataset.masked = useMaskedInput ? 'true' : 'false';
      
      // [LOG_ID: 20260624_0935] CSS 캐시 문제로 글자 숨김이 실패하는 것을 방지하기 위해 인라인 스타일로 투명도를 강제 적용함.
      if (useMaskedInput) {
        cmdInput.style.setProperty('color', 'transparent', 'important');
        cmdInput.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
        cmdInput.style.setProperty('text-shadow', 'none', 'important');
        cmdInput.style.setProperty('opacity', '0', 'important');
      } else {
        cmdInput.style.removeProperty('color');
        cmdInput.style.removeProperty('-webkit-text-fill-color');
        cmdInput.style.removeProperty('text-shadow');
        cmdInput.style.removeProperty('opacity');
      }
      // [LOG: 20260622_1620] 커맨드/로그인 입력창은 브라우저 자동완성을 항상 꺼둔다.
      // 과거 비마스킹 입력에 'on'을 줘서, 로그인 ' 회원 ID >>' 프롬프트('회원'=membership)에서
      // 크롬이 '포인트 카드 관리' 같은 멤버십/적립카드 자동완성 팝업을 띄우던 버그를 차단한다.
      cmdInput.autocomplete = 'off';
      cmdInput.spellcheck = false;
      if (typeof CustomEvent === 'function') {
        cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
      }
    }

    if (cmdPromptEl) {
      // [LOG: 20260611_1516] Keep prompt text exact; forced trailing spaces shift the empty cursor start.
      const trimmed = promptText.trimEnd();
      cmdPromptEl.textContent = trimmed || '';
      if (cmdPromptRendererEl) {
        // [LOG: 20260615_1621] Render the normal prompt through an input control so it matches #cmd-input rasterization.
        cmdPromptRendererEl.value = trimmed || '';
        schedulePromptLayoutSync();
      }
    }
  }

  async function applyCommandFooter(assetPath, fallbackText = '', fallbackAssetPath = '') {
    syncScreenContext();
    footerLoadPending = true;
    beginFooterContentUpdate();
    // [LOG: 20260617_1638] Do not hide footer while loading assets to maintain UI stability.
    if (screenEl?.parentElement) {
      screenEl.parentElement.classList.add('is-loading');
    }

    try {
      const supportedHint = getSupportedFooterText(state);
      if (supportedHint) {
        const parsedSupported = parseCommandFooter(supportedHint, supportedHint);
        setPrompt(parsedSupported.prompt);
        setHint(parsedSupported.hint);
      }

      let rawText = '';
      try {
        rawText = assetPath ? await loadAssetText(assetPath) : '';
      } catch (error) {
        console.warn(`[Terminal] Failed to load footer asset: ${assetPath}`, error);
      }

      if (!looksLikeCommandFooter(rawText) && fallbackAssetPath) {
        try {
          rawText = await loadAssetText(fallbackAssetPath);
        } catch (error) {
          console.warn(`[Terminal] Failed to load fallback footer asset: ${fallbackAssetPath}`, error);
        }
      }

      const parsed = parseCommandFooter(rawText, supportedHint || fallbackText);
      const supportedParsed = supportedHint ? parseCommandFooter(supportedHint, supportedHint) : null;
      setPrompt(supportedParsed?.prompt || parsed.prompt);
      setHint(supportedParsed?.hint || parsed.hint);
    } catch (error) {
      console.error('[Terminal] Error applying command footer:', error);
      setPrompt(DEFAULT_COMMAND_PROMPT);
      setHint(fallbackText);
    } finally {
      if (screenEl) {
        screenEl.parentElement?.classList.remove('is-loading');
        screenEl.classList.remove('is-loading');
      }
      footerLoadPending = false;
      schedulePromptLayoutSync();
      endFooterContentUpdate();
    }
  }

  // [LOG: 20260622_1900] 창 너비가 바뀌면 힌트바를 다시 측정해 들어가는 만큼 노출/숨김을 갱신한다.
  if (typeof window !== 'undefined') {
    let resizeTrimTimer = 0;
    window.addEventListener('resize', () => {
      if (resizeTrimTimer) {
        window.clearTimeout(resizeTrimTimer);
      }
      resizeTrimTimer = window.setTimeout(() => {
        resizeTrimTimer = 0;
        scheduleHintTrim();
        schedulePromptLayoutSync();
      }, 120);
    });
  }

  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready
      .then(schedulePromptLayoutSync)
      .catch(() => {});

    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', schedulePromptLayoutSync);
    }
  }

  return {
    applyCommandFooter,
    mountPromptRow,
    restorePromptRow,
    scheduleHintTrim,
    setFooterVisibility,
    setHint,
    setPrompt,
    syncScreenContext,
    toggleHintExpansion,
    trimHintEntriesToFit
  };
}
