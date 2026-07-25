import { esc, applyTerminalEffects, shouldAutoFocusCommandInput } from './uiUtils.js';
import { createTerminalDialog } from './terminalDialog.js';
import { createTerminalFeedback } from './terminalFeedback.js';
import { createTerminalHintFooter } from './terminalHintFooter.js';
import { createTerminalInputUi } from './terminalInputUi.js';
import { createTerminalSequentialRenderer } from './terminalSequentialRenderer.js';
import { createTerminalViewportMetrics } from './terminalViewportMetrics.js';
import { createTerminalLoadingState } from './terminalLoadingState.js';
import { buildLoadingScreenMarkup, normalizeLoadingMessage } from './terminalLoadingUi.js';

export function createTerminalUiCore(deps) {
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
    soundService,
    setScale,
    isManualScale,
    performanceService
  } = deps;
  let outputListener = null;
  const terminalFooter = document.getElementById('terminal-footer');
  const { syncVisualViewportMetrics, resetStableViewportHeight } = createTerminalViewportMetrics({ screenEl, state });

  function setOutputListener(callback) {
    outputListener = callback;
  }

  const hintFooter = createTerminalHintFooter({
    hintEl,
    cmdPromptEl,
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    getOutputListener: () => outputListener,
    esc
  });

  const {
    applyCommandFooter,
    mountPromptRow,
    restorePromptRow,
    setFooterVisibility,
    setHint,
    setPrompt,
    toggleHintExpansion,
    trimHintEntriesToFit
  } = hintFooter;

  const terminalDialog = createTerminalDialog({
    cmdInput,
    screenEl,
    setPrompt,
    onOpen: () => {
      if (cmdInput) {
        cmdInput.disabled = false;
        if (shouldAutoFocusCommandInput()) cmdInput.focus();
      }
      soundService.playTransition();
    },
    onClose: () => {
      if (cmdInput && terminalFooter?.dataset.footerState !== 'hidden') {
        cmdInput.disabled = false;
        if (shouldAutoFocusCommandInput()) cmdInput.focus();
      }
    }
  });

  const terminalWrapper = document.getElementById('terminal-wrapper');
  applyTerminalEffects(terminalWrapper, true);
  syncVisualViewportMetrics();
  setFooterVisibility(false);

  const { renderInitError, setBusy, showError, showNotification } = createTerminalFeedback({
    screenEl,
    hintEl,
    cmdPromptEl,
    cmdInput,
    soundService,
    getOutputListener: () => outputListener,
    setFooterVisibility,
    setReady: (isReady) => loadingState.setReady(isReady)
  });

  // [LOG_ID: 20260715_1700] setReady/setLoading 로딩 상태 전이 로직은 terminalLoadingState.js로
  // 분리했다 — 이 파일 자체가 qa:final의 250줄 제한(core 파일 대상)을 넘어서(295줄) 발견됨.
  const loadingState = createTerminalLoadingState({
    screenEl,
    cmdInput,
    setBusy,
    setFooterVisibility,
    buildLoadingScreenMarkup,
    normalizeLoadingMessage
  });

  function echoCommand(cmdText) {
    if (!screenEl || !cmdText) return;
    const prompt = cmdPromptEl?.textContent || '>>';
    const echoLine = document.createElement('div');
    echoLine.className = 'ansi-line command-echo';
    echoLine.innerHTML = `<span class="ansi-cyan">${esc(prompt)}</span> <span class="ansi-white">${esc(cmdText)}</span>`;
    screenEl.appendChild(echoLine);
    echoLine.scrollIntoView({ behavior: 'auto', block: 'end' });
  }

  const {
    adjustZoom,
    autoAdjustZoom,
    initBlinkingCursor,
    initTooltips,
    initZoom,
    setGhostText,
    setSuggestions,
    setZoom,
    updateCursorPosition
  } = createTerminalInputUi({
    cmdInput,
    screenEl,
    state,
    setScale,
    isManualScale,
    syncVisualViewportMetrics
  });

  const { interruptRendering, renderScreenSequential } = createTerminalSequentialRenderer({
    screenEl,
    performanceService,
    soundService,
    setBusy,
    showNotification,
    state
  });

  const core = {
    renderInitError,
    showError,
    initTooltips,
    initBlinkingCursor,
    initZoom,
    autoAdjustZoom,
    setZoom,
    adjustZoom,
    setHint,
    setOutputListener,
    getOutputListener: () => outputListener,
    setPrompt,
    setSuggestions,
    setGhostText,
    applyCommandFooter: async (assetPath, fallbackText, fallbackAssetPath) => {
      try {
        await hintFooter.applyCommandFooter(assetPath, fallbackText, fallbackAssetPath);
      } finally {
        core.setReady(true);
        // [LOG_ID: 20260708_1215] 힌트/프롬프트 내용이 확정되는 이 시점에만 하단 구분선을 드러낸다.
        // setLoading()이 화면 전환 시작과 동시에 켠 is-divider-pending을 여기서 끈다 (아래 setLoading 주석 참고).
        terminalFooter?.classList.remove('is-divider-pending');
      }
    },
    mountPromptRow,
    restorePromptRow,
    setFooterVisibility,
    esc,
    toggleHintExpansion,
    setReady: loadingState.setReady,
    setLoading: loadingState.setLoading,
    buildLoadingScreenMarkup,
    setBusy,
    echoCommand,
    showNotification,
    showToast: (text, duration = 2500, level = 'info') => {
      showNotification(text, duration, level);
    },
    renderScreenSequential,
    interruptRendering,
    showConfirm: terminalDialog.showConfirm,
    showAlert: terminalDialog.showAlert,
    showPrompt: terminalDialog.showPrompt,
    showEditor: terminalDialog.showEditor
  };

  // [LOG_ID: 20260725_1635] 키보드가 열리는 ~300ms 애니메이션 동안 syncVisualViewportMetrics()를
  // 150ms 디바운스 뒤에야(즉 애니메이션이 다 끝난 뒤) 단 한 번 실행했다. 그 지연 구간 동안엔
  // --mobile-visual-viewport-height가 아직 옛 값(키보드 없음 기준)이라 레이아웃이 줄어들지 않고,
  // 브라우저가 대신 자체적으로 "포커스된 입력창을 보이게" 화면을 스크롤/팬 시켜버려(사용자 실측
  // 영상: 메뉴 항목들이 위로 스쳐 지나가다 뒤늦게 축소된 정상 레이아웃으로 튐) 키보드 여닫을 때마다
  // "화면이 위로 갔다가 다시 내려가는" 듯한 요동으로 보였다. 뷰포트 치수 갱신(가볍다 — CSS 변수
  // 몇 개 설정)은 매 이벤트마다 즉시 실행해 우리 축소 로직이 키보드 애니메이션과 실시간으로
  // 함께 움직이도록 하고, 무거운 후속 작업(힌트바 트리밍·커서 위치·자동 줌)만 디바운스로 미룬다.
  let _resizeTimeout = null;
  const _onResize = () => {
    syncVisualViewportMetrics();
    if (_resizeTimeout) clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(() => {
      trimHintEntriesToFit();
      if (cmdInput && document.activeElement === cmdInput) {
        updateCursorPosition();
      }
      if (!isManualScale()) {
        autoAdjustZoom();
      }
    }, 150);
  };
  window.addEventListener('resize', _onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _onResize);
    window.visualViewport.addEventListener('scroll', _onResize);
  }
  // [LOG_ID: 20260721_1500] 화면 회전은 키보드 개폐와 달리 실제로 기준 높이가 바뀌는 경우라,
  // 고정해둔 --stable-vh를 강제로 다시 읽는다(모니터링만 하는 위 resize는 더 큰 값만 채택하는
  // monotonic-max라 회전으로 더 작아진 새 방향에는 자동으로 안 좁혀지기 때문).
  window.addEventListener('orientationchange', () => {
    window.setTimeout(resetStableViewportHeight, 150);
  });
  // [LOG_ID: 20260725_1610] 20260711_1320에서 Chromium Android의 VirtualKeyboard API를 오버레이
  // 모드(overlaysContent=true)로 전환했었는데, 이 모드에서는 브라우저가 키보드 개폐로 더 이상
  // visualViewport를 자동으로 줄여주지 않아 "키보드가 열리면 화면이 밀려 올라가는" 표준 동작이
  // 사라지고, 대신 앱이 geometrychange/boundingRect로 직접 키보드 높이를 계산해 보정해야 했다.
  // 실기기에서 이 보정이 항상 즉시·정확히 반영되지 않아 키보드가 하단 UI(입력창 포함)를 그냥
  // 덮어버리는 문제로 사용자에게 재보고됨(20260725, 참고 스크린샷: 일반 앱처럼 키보드가 뜨면
  // 기존 콘텐츠가 위로 밀려야 한다는 지적). 오버레이 모드 강제를 제거해 브라우저 기본 동작
  // (resizes-visual — visualViewport가 실제로 줄어듦)으로 되돌린다. terminalViewportMetrics.js의
  // 기존 visualViewport 기반 계산 경로(--stable-vh로 폰트 크기는 그대로 고정, 20260721_1500)가
  // 그 축소값을 그대로 받아 --mobile-visual-viewport-height/--mobile-keyboard-inset을 갱신하므로
  // 폰트 출렁임 없이 레이아웃만 정상적으로 키보드 위로 밀려 올라간다.

  return core;
}
