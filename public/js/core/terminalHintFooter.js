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

  // [LOG_ID: 20260711_2155] 힌트바의 토큰이 아닌 영역을 탭/클릭하면 펼침을 토글한다.
  // 넘쳐서 숨겨진 명령은 도움말(H) 토큰의 hover 툴팁에 모이는데(20260622_1900 사용자 선택),
  // 터치 기기는 hover가 없고 펼치기 명령(+)도 키보드 전용이라 숨겨진 명령을 볼 방법이 없었다.
  // 토큰 자체의 클릭은 appEvents의 캡처 단계 명령 리스너가 stopImmediatePropagation으로 먼저
  // 소비하므로 여기(버블 단계)에는 토큰이 아닌 영역의 클릭만 도달한다. 숨겨진 명령이 없으면
  // (hintExpandable=false, 펼침 상태도 아님) 아무 동작도 하지 않는다.
  if (hintEl) {
    hintEl.addEventListener('click', (event) => {
      if (event.target.closest?.('.cmd-token')) {
        return;
      }
      if (hintEl.dataset.hintExpandable !== 'true' && !hintEl.classList.contains('is-expanded')) {
        return;
      }
      toggleHintExpansion();
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

    // [LOG_ID: 20260729_1500] 비밀번호 모드(login/signup/myinfo 마스킹 단계)가 아닌 일반 화면으로 전환 시
    // 마스킹 상태(_maskCommandInput)를 명시적으로 해제해 메뉴 클릭 시 번호가 *로 마스킹되는 현상을 방지한다.
    const isSensitiveScreen = screenName === 'signup' || screenName === 'login' || screenName === 'myinfo';
    if (!isSensitiveScreen && state._maskCommandInput) {
      state._maskCommandInput = false;
    }

    // [LOG: 20260507_1757] Keep /myinfo edit prompts in the footer so the active input stays at the bottom.
    restorePromptRow();

    if (document.body) {
      if (screenName) {
        document.body.dataset.screen = screenName;
      } else {
        delete document.body.dataset.screen;
      }
      // [LOG_ID: 20260710_1203] PR 갈무리(전체 보기) 모드일 때 print-view 속성을 html/body에 설정하여 세로 늘어남을 가능케 함
      if (screenName === 'news-view' && state.serviceData?._printView) {
        document.body.dataset.printView = 'true';
        document.documentElement.dataset.printView = 'true';
      } else {
        delete document.body.dataset.printView;
        delete document.documentElement.dataset.printView;
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
    // [LOG_ID: 20260726_1515] 이 함수로 인라인 마운트되는 프롬프트(오락실/아케이드/로그인/
    // 비밀번호 재설정/내 정보 편집 등 모든 호출부 공용)는 footer가 아니라 스크롤 가능한
    // 화면 본문 안에 붙는다 — 본문이 길어지면(라운드별 힌트 목록, 여러 단계 트랜스크립트 등)
    // 이 프롬프트가 뷰포트 밖으로 밀릴 수 있다(320x568 실측으로 발견: 스크램블 게임).
    // 호출부마다 개별적으로 처리하는 대신 이 공용 함수 한 곳에서 처리해 향후 호출부가
    // 추가돼도 자동으로 적용되게 한다. block:'nearest'라 이미 보이면 아무 것도 하지 않는다.
    targetEl.scrollIntoView({ block: 'nearest' });

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

      // [LOG_ID: 20260729_1511] 힌트 텍스트 내에 줄바꿈(\n)이 포함된 경우, 
      // 첫째 줄(진짜 힌트)만 추출하여 하단 힌트바에 렌더링하고 둘째 줄(프롬프트 문자열)은 필터링한다.
      let hintText = text;
      if (typeof text === 'string' && text.includes('\n')) {
        hintText = text.split('\n')[0];
      }

      const markup = renderHintMarkup(hintText);
      hintEl.innerHTML = markup;
      hintEl.classList.toggle('has-cmd-tokens', markup.includes('cmd-token'));
      trimHintEntriesToFit();
      scheduleHintTrim();

      const isLoadingScreen = Boolean(
        screenEl?.parentElement?.classList.contains('is-loading')
        || screenEl?.classList.contains('is-loading')
      );

      if (
        hintText
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

  // [LOG_ID: 20260712_0010] 20260711_2210에서 넣었던 프롬프트 위치 접두('[열린광장] 선택 >>')는
  // 사용자 결정으로 제거 — 기본 프롬프트는 항상 '선택 >>'. 아래 사용자 정의(SET PROMPT) 처리는
  // 20260711_2340 SET 수정과 짝이므로 유지한다.
  function setPrompt(text) {
    // [LOG_ID: 20260724_0955] 혈액형 핫스팟 모조 프롬프트 복원 가드
    const mock = document.getElementById('blood-prompt-renderer-mock');
    if (mock) {
      mock.remove();
    }
    if (cmdPromptRendererEl && cmdPromptRendererEl.style.display === 'none') {
      cmdPromptRendererEl.style.display = '';
    }

    // applyCommandFooter는 파싱된 기본 프롬프트('선택 >>')를 명시 문자열로 전달하므로,
    // 기본 프롬프트와 동일한 텍스트도 사용자 정의 치환 대상으로 취급한다.
    // envVars.PROMPT의 초기값 '>>'는 settingsService가 넣는 "사용자 정의 없음" 센티널이므로
    // 사용자 정의 프롬프트로 취급하지 않는다(SET PROMPT로 바꾼 값만 존중).
    const customPrompt = String(state.envVars?.PROMPT || '').trim();
    const userPrompt = customPrompt && customPrompt !== '>>' ? customPrompt : '';
    const promptText = (text === undefined || text === null || text === '>>' || String(text).trim() === DEFAULT_COMMAND_PROMPT)
      ? (userPrompt || DEFAULT_COMMAND_PROMPT)
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
        // [LOG_ID: 20260709_0945] 텍스트가 변경된 즉시 너비도 동기적으로 동기화한다.
        // 비동기 schedulePromptLayoutSync()에만 의존하면, value가 바뀌는 즉시 폭이 맞춰지지 않아
        // 이전 프롬프트 너비(예: '비밀번호 >>' 등 넓은 폭)가 일시적으로 노출되어 커서가 우측으로 멀리 밀리는
        // space2 현상이 화면 전환 시점마다 항상 발생했다. 즉시 너비를 맞추어 갭을 완벽히 차단한다.
        syncPromptRendererWidth();
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
      if (supportedHint !== null && supportedHint !== undefined) {
        const parsedSupported = parseCommandFooter(supportedHint, supportedHint);
        setPrompt(parsedSupported.prompt || '');
        setHint(parsedSupported.hint || '');
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
      // [LOG_ID: 20260709_0950] 로딩이 끝나는 그 즉시 가로 폭도 동기식으로 맞추어,
      // is-loading 제거로 인해 발생하는 커서의 즉각적인 위치 재계산 타이밍과 싱크를 완벽히 맞춘다.
      syncPromptRendererWidth();
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
      .then(() => {
        // [LOG_ID: 20260709_0950] 폰트 로드 완료 즉시 동기식으로 너비를 맞추어,
        // 동일 시점에 동기식으로 동작하는 커서 폰트 동기화 스케줄러와 싱크를 맞춘다.
        syncPromptRendererWidth();
        schedulePromptLayoutSync();
      })
      .catch(() => {});

    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', () => {
        syncPromptRendererWidth();
        schedulePromptLayoutSync();
      });
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
