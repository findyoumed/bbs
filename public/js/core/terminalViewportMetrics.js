// [LOG: 20260617_1005] Mobile visual viewport metrics split from terminalUiCore.js.
export function createTerminalViewportMetrics({ screenEl }) {
  let mobileKeyboardVisible = false;

  function syncVisualViewportMetrics() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const vv = window.visualViewport;
    const fallbackHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, 0);
    // [LOG_ID: 20260711_1320] VirtualKeyboard API 오버레이 모드(terminalUiCore에서 활성화)에서는
    // 키보드가 떠도 뷰포트가 줄지 않으므로 기존 계산(layout-visual 차)이 항상 0이 된다.
    // 이 모드에서는 키보드 높이를 boundingRect에서 직접 읽고, 시각 높이도 그만큼 빼서 만든다.
    const vk = typeof navigator !== 'undefined' ? navigator.virtualKeyboard : null;
    const vkOverlayMode = !!(vk && vk.overlaysContent === true);
    const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, vv ? vv.height : fallbackHeight);
    const keyboardInset = vkOverlayMode
      ? Math.max(0, Math.round(vk.boundingRect?.height || 0))
      : (vv ? Math.max(0, Math.round(layoutHeight - (vv.height + vv.offsetTop))) : 0);
    const viewportHeight = vkOverlayMode
      ? Math.max(0, layoutHeight - keyboardInset)
      : (vv ? vv.height : fallbackHeight);
    const viewportTop = vkOverlayMode ? 0 : (vv ? vv.offsetTop : 0);
    const viewportWidth = vv ? vv.width : (window.innerWidth || document.documentElement?.clientWidth || 0);
    const keyboardVisible = keyboardInset >= 96;
    const keyboardJustClosed = mobileKeyboardVisible && !keyboardVisible;

    root.style.setProperty('--mobile-visual-viewport-height', `${Math.round(viewportHeight)}px`);
    root.style.setProperty('--mobile-visual-viewport-width', `${Math.round(viewportWidth)}px`);
    root.style.setProperty('--mobile-visual-viewport-top', `${Math.round(viewportTop)}px`);
    root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
    root.style.setProperty('--mobile-keyboard-visible', keyboardVisible ? '1' : '0');

    if (body) {
      body.dataset.mobileKeyboard = keyboardVisible ? 'visible' : 'hidden';
    }

    if (keyboardJustClosed && screenEl) {
      const resetScrollPosition = () => {
        screenEl.scrollTop = 0;
      };
      window.requestAnimationFrame(() => {
        resetScrollPosition();
        window.setTimeout(resetScrollPosition, 120);
      });
    }

    mobileKeyboardVisible = keyboardVisible;
  }

  return { syncVisualViewportMetrics };
}
