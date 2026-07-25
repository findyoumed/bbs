// [LOG: 20260617_1005] Mobile visual viewport metrics split from terminalUiCore.js.
export function createTerminalViewportMetrics({ screenEl }) {
  let mobileKeyboardVisible = false;
  let stableViewportHeight = 0;

  // [LOG_ID: 20260721_1500] 모바일 폰트 크기 clamp가 순정 vh 단위를 썼는데, 이 기기/브라우저
  // 설정에서는 vh가 소프트웨어 키보드가 열릴 때마다 줄어들어(VirtualKeyboard 오버레이 모드가
  // 안 먹는 경우) 화면 전체 글자 크기가 키보드 열고 닫을 때마다 눈에 띄게 출렁였다(사용자 실측
  // 스크린샷: "회원 ID" 라벨까지도 크기가 달랐음). 사용자가 명시적으로 "폰트 크기 고정, 대신
  // 가려진 내용은 스크롤로" 선택했다.
  // [LOG_ID: 20260721_1535] 최초 구현("관측된 값 중 가장 큰 높이만 채택하는 monotonic-max")은
  // 키보드뿐 아니라 모바일 브라우저의 접이식 주소창(스크롤에 따라 나타났다 사라짐)이 만드는
  // *정상적인* 높이 변화까지 통째로 무시해버렸다 — 주소창이 잠깐 숨겨졌을 때의 더 큰 높이가
  // 기준으로 굳어버리면, 주소창이 다시 나타나 실제 가용 높이가 줄어든 뒤에도 폰트는 여전히 그
  // 더 큰 기준으로 계산돼 실제 화면보다 커져 긴 게시글 본문 아래가 잘리고 스크롤바까지 뜨는
  // 결과를 냈다(사용자 지적: "모바일에서 아직도 하단이 짤리고 스크롤바가 있어"). 이 파일이 이미
  // 계산해두는 정밀한 keyboardVisible 신호를 그대로 재사용해, "키보드 때문에 줄어든 경우만"
  // 무시하고 그 외(주소창 변화, 실제 리사이즈 등)의 높이 변화는 항상 정직하게 반영한다.
  function syncStableViewportHeight(forceReset, currentHeight) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const height = currentHeight
      ?? Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
    if (height <= 0) return;
    if (forceReset || height !== stableViewportHeight) {
      stableViewportHeight = height;
      root.style.setProperty('--stable-vh', `${Math.round(stableViewportHeight)}px`);
    }
  }

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
    const keyboardJustOpened = !mobileKeyboardVisible && keyboardVisible;

    // 키보드가 떠 있을 때만 건너뛴다 — 주소창 접힘/펼침 등 다른 정당한 높이 변화는 항상 반영한다.
    if (!keyboardVisible) {
      syncStableViewportHeight(false, layoutHeight);
    }

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

    // [LOG_ID: 20260725_1645] 키보드가 열려 #terminal-screen이 줄어들면(위 CSS의
    // body[data-mobile-keyboard="visible"] 오버라이드) 기본 스크롤 위치(맨 위)라 목록의 아래쪽
    // (입력창에 가까운 부분)이 잘려 보였다(사용자 지적: "원하는건 아래쪽이 보이고, 위쪽은 위로
    // 밀려올라가는거야" — 일반 채팅앱처럼 최신/아래 내용이 남고 위쪽이 스크롤되어 사라지길 원함).
    // 키보드가 막 열린 순간 맨 아래로 스크롤해 그 기대에 맞춘다. CSS 오버라이드가 적용되어
    // scrollHeight가 실제로 늘어날 시간이 필요해 keyboardJustClosed와 동일하게 rAF+지연 재시도.
    if (keyboardJustOpened && screenEl) {
      const scrollToBottom = () => {
        screenEl.scrollTop = screenEl.scrollHeight;
      };
      window.requestAnimationFrame(() => {
        scrollToBottom();
        window.setTimeout(scrollToBottom, 120);
      });
    }

    mobileKeyboardVisible = keyboardVisible;
  }

  function resetStableViewportHeight() {
    syncStableViewportHeight(true);
  }

  return { syncVisualViewportMetrics, resetStableViewportHeight };
}
