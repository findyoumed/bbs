// [LOG: 20260617_1005] Mobile visual viewport metrics split from terminalUiCore.js.
export function createTerminalViewportMetrics({ screenEl }) {
  let mobileKeyboardVisible = false;

  function syncVisualViewportMetrics() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const vv = window.visualViewport;
    const fallbackHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, 0);
    const viewportHeight = vv ? vv.height : fallbackHeight;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : (window.innerWidth || document.documentElement?.clientWidth || 0);
    const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, viewportHeight);
    const keyboardInset = vv
      ? Math.max(0, Math.round(layoutHeight - (vv.height + vv.offsetTop)))
      : 0;
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
