import { UI_TEXT } from './i18n.js';
import { CMD_META } from './commandService.js';
import { esc } from './uiUtils.js';
import { displayWidth } from './ansiRenderUtils.js';

export function createTerminalInputUi(deps) {
  const {
    cmdInput,
    screenEl,
    state,
    setScale,
    isManualScale,
    syncVisualViewportMetrics
  } = deps;

  let ghostTextEl = null;
  let maskTextEl = null;
  let cursorMeasureContext = null;
  let selectedSuggestionIndex = -1;
  let cursorStateObserver = null;
  let fontCursorSyncRegistered = false;
  // [LOG_ID: 20260623_1330] Normal input uses the PC-communication block cursor.
  // Loading and command-pending states keep their own dot/underscore indicators.
  const useCustomCursor = true;
  // [LOG: 20260506_1315] Command suggestion UI disabled due to frequent misfires.
  // const suggestionBoxEl = document.getElementById('cmd-suggestion-box');
  const suggestionBoxEl = null;

  const cursorEl = (() => {
    const el = document.createElement('span');
    el.className = 'terminal-cursor';
    return el;
  })();

  const cmdTooltipEl = (() => {
    let el = document.getElementById('cmd-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cmd-tooltip';
      document.body.appendChild(el);
    }
    return el;
  })();

  function initTooltips() {
    const updateTooltipPos = (event) => {
      cmdTooltipEl.style.left = `${event.clientX + 10}px`;
      cmdTooltipEl.style.top = `${event.clientY - 24}px`;
    };

    document.addEventListener('mouseover', (event) => {
      const token = event.target.closest?.('.cmd-token');
      if (!token) {
        cmdTooltipEl.style.display = 'none';
        return;
      }
      cmdTooltipEl.textContent = token.dataset.tip || '';
      cmdTooltipEl.style.display = 'block';
      updateTooltipPos(event);
    });

    document.addEventListener('mousemove', (event) => {
      if (cmdTooltipEl.style.display === 'none') {
        return;
      }
      updateTooltipPos(event);
    });

    document.addEventListener('mouseout', (event) => {
      if (event.target.closest?.('.cmd-token')) {
        cmdTooltipEl.style.display = 'none';
      }
    });
  }

  // [LOG_ID: 20260623_1345] The terminal input and password-star overlay use fixed cells.
  // Position the block cursor in the same cell unit, not canvas glyph pixels.
  function updateCursorPosition() {
    if (!cmdInput || !cursorEl) {
      return;
    }

    const textBeforeCaret = cmdInput.value.substring(0, cmdInput.selectionStart || 0);
    // [LOG_ID: 20260709] ch→em: 이 파일 나머지 폭 계산(.terminal-cursor width, prompt renderer width 등)과
    // 동일하게 폰트 전환에 흔들리지 않는 em 단위로 통일한다. ch는 폴백 폰트와 커스텀 폰트에서 폭이 달라
    // 폰트 로딩 시점에 캐럿이 좌우로 튀는 원인이 될 수 있었다.
    cursorEl.style.left = `${displayWidth(textBeforeCaret) * 0.5}em`;
  }

  function getCursorMeasureContext() {
    if (cursorMeasureContext) {
      return cursorMeasureContext;
    }

    const canvas = document.createElement('canvas');
    cursorMeasureContext = canvas.getContext('2d');
    return cursorMeasureContext;
  }

  function measureInputTextWidth(text) {
    const normalizedText = String(text || '');
    if (!normalizedText) {
      return 0;
    }

    const measureContext = getCursorMeasureContext();
    if (!cmdInput || !measureContext) {
      return displayWidth(text);
    }

    const inputStyle = window.getComputedStyle(cmdInput);
    measureContext.font = inputStyle.font;

    const baseWidth = measureContext.measureText(normalizedText).width;
    const letterSpacing = Number.parseFloat(inputStyle.letterSpacing);
    if (!Number.isFinite(letterSpacing) || letterSpacing === 0) {
      return baseWidth;
    }

    return baseWidth + (Math.max(0, Array.from(normalizedText).length - 1) * letterSpacing);
  }

  // [LOG: 20260611_1413] Re-run cursor sync after web fonts and layout frames settle.
  function scheduleCursorLayoutSync() {
    syncMaskedInputDisplay();
    syncCursorVisibility();

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();

      window.setTimeout(() => {
        syncMaskedInputDisplay();
        syncCursorVisibility();
      }, 50);
    });
  }

  // [LOG: 20260611_1413] document.fonts.ready covers the initial font-load race that can skew cursor width.
  function registerFontCursorSync() {
    if (fontCursorSyncRegistered || typeof document === 'undefined' || !document.fonts) {
      return;
    }

    fontCursorSyncRegistered = true;

    document.fonts.ready
      .then(scheduleCursorLayoutSync)
      .catch(() => {});

    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', scheduleCursorLayoutSync);
    }
  }

  function getTerminalContainer() {
    return document.getElementById('terminal-container');
  }

  function shouldRenderCursor() {
    const container = getTerminalContainer();
    const hasLoadingScreen = Boolean(screenEl?.querySelector('.loading'));

    // [LOG_ID: 20260708_2015] !cmdInput.disabled 조건을 제거한다. setLoading()이 데이터 로딩(예:
    // showMain()의 await Promise.all(...)) 시작과 동시에 cmdInput.disabled=true를 걸어두는데,
    // 이 시점엔 아직 renderAnsiScreenWithTopbarSequential이 시작 전이라 화면(프롬프트 텍스트 "선택 >>"
    // 포함)은 이전 화면 그대로 남아있다 — 오직 커서만 이 조건 때문에 사라져, "프롬프트 텍스트는
    // 있는데 캐럿만 없는" 비일관성이 로딩 시간(수백 ms)만큼 노출됐다("space2처럼 넓어 보였다가
    // 저절로 좁아진다"는 재보고의 실제 정체 — 화면 녹화 프레임 분석으로 확정: 커서만 정확히 로딩
    // 구간 동안 사라짐). 실제 입력 차단은 disabled 속성 자체로 이미 충분히 보장되므로, 커서까지
    // 시각적으로 숨길 필요가 없다 — 이 세션에서 반복 확인된 "하단 요소는 항상 함께 변해야 한다"는
    // 원칙에 맞춘다.
    const result = Boolean(
      cmdInput
      && cursorEl
      && useCustomCursor
      && !hasLoadingScreen
      // [LOG: 20260707_1750] CSS(retro-terminal.css .fonts-loading .terminal-cursor)와 판단 기준을 일치시킨다.
      // JS가 fonts-loading을 무시하고 visible로 판단하면 재시도가 종료된 채 CSS만 숨겨 커서가 사라진 상태로 고착됐다.
      && !document.documentElement.classList.contains('fonts-loading')
      && !container?.classList.contains('is-loading')
      && !container?.classList.contains('is-busy')
      && !container?.classList.contains('is-data-busy')
    );
    return result;
  }

  let cursorRetryTimer = 0;

  function syncCursorVisibility() {
    if (!cursorEl) {
      return;
    }

    // [LOG: 20260707_1750] 프롬프트 행 DOM 재구성 등으로 커서 요소가 분리되면 자가 복구한다.
    if (!cursorEl.isConnected && cmdInput?.parentElement) {
      cmdInput.parentElement.appendChild(cursorEl);
    }

    const visible = shouldRenderCursor();
    // [LOG: 20260707_1700] Keep the cursor cell reserved even when the input is not focused.
    // Hiding it with display:none made the prompt appear to gain/lose one terminal cell on click.
    // [LOG_ID: 20260707_1930] 실제 PC통신 단말에는 브라우저의 focus/blur 개념이 없다 — 커서는 항상 같은 방식으로
    // 깜빡인다. document.activeElement 기준으로 밝기(1 vs 0.35)를 바꾸던 예전 로직은, 클릭 한 번으로 잠깐
    // blur된 순간마다 커서가 흐릿한 반투명 덩어리로 보여 "포커스 여부에 따라 프롬프트 뒤 여백이 달라 보인다"는
    // 착시를 만들었다. 이 앱은 모든 입력을 #cmd-input 하나로만 받으므로(터미널 다이얼로그도 동일 입력 재사용)
    // 논리적으로 이 입력창은 항상 "활성" 상태다 — 브라우저 DOM 포커스 여부와 무관하게 항상 동일하게 그린다.
    // [LOG_ID: 20260707_2030] display: none 대신 visibility: hidden을 사용하여
    // 커서가 숨겨진 상태(로딩/블러)에서도 1ch 너비의 레이아웃 영역을 보존함으로써
    // 포커스 여부에 따라 입력 필드 왼쪽 공백이 튀는 현상을 완전히 방지한다.
    cursorEl.style.setProperty('visibility', visible ? 'visible' : 'hidden');
    cursorEl.style.removeProperty('opacity');
    cursorEl.style.removeProperty('animation');

    if (visible) {
      if (cursorRetryTimer) {
        window.clearTimeout(cursorRetryTimer);
        cursorRetryTimer = 0;
      }
      updateCursorPosition();
      return;
    }

    // [LOG: 20260707_1750] 로딩류 차단 조건(is-loading/.loading/is-busy/disabled)으로 숨긴 경우,
    // 조건 해제가 이벤트 없이 끝나는 경로에서는 재동기화가 일어나지 않아 커서가 꺼진 채
    // 고착됐다(news/weather 진입 시 로드마다 커서 유무가 달라져 프롬프트 공백이 달라 보이던 원인).
    // 숨김 상태 동안에는 조건과 무관하게 짧은 재시도를 걸어 최종 상태에 수렴시킨다.
    if (cursorRetryTimer) {
      window.clearTimeout(cursorRetryTimer);
    }
    cursorRetryTimer = window.setTimeout(() => {
      cursorRetryTimer = 0;
      syncCursorVisibility();
    }, 200);
  }

  function syncMaskedInputDisplay() {
    if (!cmdInput || !maskTextEl) {
      return;
    }

    const isMasked = cmdInput.dataset.masked === 'true';
    const maskLength = isMasked ? Array.from(cmdInput.value || '').length : 0;
    maskTextEl.textContent = maskLength > 0 ? '*'.repeat(maskLength) : '';
    maskTextEl.hidden = !isMasked || maskLength <= 0;
    maskTextEl.parentElement?.classList.toggle('has-masked-input', isMasked);
  }

  function initBlinkingCursor() {
    if (!cmdInput) {
      return;
    }

    let wrapper = document.getElementById('cmd-input-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'cmd-input-wrapper';
      cmdInput.parentNode.insertBefore(wrapper, cmdInput);

      const ghost = document.createElement('div');
      ghost.id = 'cmd-ghost-text';
      wrapper.appendChild(ghost);
      ghostTextEl = ghost;

      // [LOG: 20260507_1757] Draw password masks ourselves so browser password glyph rendering cannot appear blank.
      const maskText = document.createElement('div');
      maskText.id = 'cmd-mask-text';
      maskText.setAttribute('aria-hidden', 'true');
      maskText.hidden = true;
      wrapper.appendChild(maskText);
      maskTextEl = maskText;

      wrapper.appendChild(cmdInput);
      wrapper.appendChild(cursorEl);
    } else if (!ghostTextEl) {
      ghostTextEl = document.getElementById('cmd-ghost-text');
    }
    if (!maskTextEl) {
      maskTextEl = document.getElementById('cmd-mask-text');
    }
    if (!maskTextEl) {
      const maskText = document.createElement('div');
      maskText.id = 'cmd-mask-text';
      maskText.setAttribute('aria-hidden', 'true');
      maskText.hidden = true;
      wrapper.insertBefore(maskText, cmdInput);
      maskTextEl = maskText;
    }

    cmdInput.addEventListener('input', () => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });
    cmdInput.addEventListener('beforeinput', () => window.requestAnimationFrame(syncCursorVisibility));
    cmdInput.addEventListener('click', syncCursorVisibility);
    cmdInput.addEventListener('keyup', syncCursorVisibility);
    cmdInput.addEventListener('mouseup', syncCursorVisibility);
    cmdInput.addEventListener('select', syncCursorVisibility);
    cmdInput.addEventListener('compositionupdate', syncCursorVisibility);
    cmdInput.addEventListener('compositionend', syncCursorVisibility);
    cmdInput.addEventListener('focus', () => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
      window.setTimeout(syncVisualViewportMetrics, 0);
    });
    cmdInput.addEventListener('blur', () => {
      syncCursorVisibility();
      window.setTimeout(syncVisualViewportMetrics, 120);
    });
    cmdInput.addEventListener('keydown', () => window.setTimeout(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    }, 0));
    cmdInput.addEventListener('bbs:mask-state-change', () => {
      // [LOG: 20260707_1735] 값 클리어/프롬프트 교체 시 커서 위치도 재계산한다.
      // 커서가 비포커스에도 항상 표시되도록 바뀐 뒤(20260707_1700), 명령 제출 직후 화면 전환에서
      // 이전 명령 길이만큼 오른쪽으로 밀린 커서 잔상이 남아 news/weather 간 캐럿 왼쪽 공백이
      // 다르게 보이던 문제(포커스를 줘야만 정상 복귀)의 원인이었다.
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });
    // [LOG_ID: 20260708_1650] 커서가 숨겨진 상태(is-busy/is-loading 등)에서 벗어나는 걸 감지하려고
    // syncCursorVisibility() 안에서 200ms 간격 setTimeout 재시도(cursorRetryTimer)로 폴링하는데,
    // 브라우저는 탭이 백그라운드(비활성)로 가면 이 setTimeout을 강하게 스로틀링한다(수 초까지 지연 가능) —
    // 스크린샷 도구 등으로 잠깐 다른 창에 포커스를 뺏기는 사이 재시도가 멈춰, 실제로는 이미 로딩이 끝났는데도
    // 커서만 계속 숨겨진 채(그 자리가 빈 여백처럼 보임) 고착됐다가, 탭이 다시 보이자마자(또는 아무 키 입력으로
    // 스로틀링이 풀리자마자) 뒤늦게 정상화되는 것처럼 보였다. visibilitychange는 스로틀링 없이 탭이 다시
    // 보이는 즉시 발동하므로, 여기서 직접 재동기화해 setTimeout 폴링이 풀릴 때까지 기다리지 않게 한다.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        syncCursorVisibility();
      }
    });
    window.addEventListener('focus', () => {
      syncCursorVisibility();
    });

    document.addEventListener('selectionchange', () => {
      if (document.activeElement === cmdInput) {
        syncCursorVisibility();
      }
    });

    cursorStateObserver?.disconnect();
    cursorStateObserver = new MutationObserver(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });

    const container = getTerminalContainer();
    if (container) {
      cursorStateObserver.observe(container, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    // [LOG: 20260707_1750] fonts-loading 클래스는 <html>에 붙으므로 함께 감시해야
    // 폰트 로드 완료 시 커서 표시 상태가 즉시 재동기화된다.
    cursorStateObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    if (screenEl) {
      // [LOG: 20260429_0955] Hide the prompt cursor while loading text is rendered on screen.
      // [LOG_ID: 20260708_1650] subtree: false였을 때는 screenEl의 "직계 자식"이 바뀔 때만 감지했다.
      // 20260708_1520에서 로딩 placeholder(.loading)를 screenEl 전체 교체 대신 .ansi-screen-body
      // 내부(screenEl의 손자)에 넣도록 바꾼 뒤로, 이 감시가 로딩 시작/종료를 더 이상 감지하지 못하게 됐다 —
      // shouldRenderCursor()의 hasLoadingScreen 판정 자체는 여전히 정확하지만(querySelector는 하위 전체를
      // 훑음), 그 변화를 알아채 재동기화를 트리거하는 통로가 사라져 커서가 숨겨진 채(200ms setTimeout
      // 재시도에만 의존) 고착되기 쉬워졌다 — 탭이 백그라운드로 가면 그 setTimeout이 스로틀링돼 수 초씩
      // 갇혀, "포커스를 줘야만(또는 탭이 다시 보여야만) 정상화된다"는 여백 문제의 근본 원인이었다.
      // subtree: true로 손자 이하 변화까지 확실히 감지한다.
      cursorStateObserver.observe(screenEl, {
        childList: true,
        subtree: true
      });
    }

    cursorStateObserver.observe(cmdInput, {
      attributes: true,
      attributeFilter: ['data-masked', 'disabled', 'type']
    });

    syncMaskedInputDisplay();
    syncCursorVisibility();
    registerFontCursorSync();
  }

  function setSuggestions(matches, selectedIndex = -1) {
    /*
    [LOG: 20260506_1315] Command suggestion UI disabled.
    if (!suggestionBoxEl) {
      return;
    }

    selectedSuggestionIndex = selectedIndex;

    if (!matches || matches.length === 0) {
      suggestionBoxEl.classList.remove('has-suggestions');
      suggestionBoxEl.innerHTML = '';
      return;
    }

    if (matches.length === 1 && selectedIndex === -1) {
      const cmd = matches[0];
      const meta = CMD_META[cmd] || {};
      const label = meta.label || cmd;
      const tip = meta.tip || cmd;
      const desc = meta.desc || '';

      suggestionBoxEl.innerHTML = `
        <div class="suggestion-quick-hint">
          <span class="hint-label">${esc(label)}</span>
          <span class="hint-sep">|</span>
          <span class="hint-tip">${esc(tip)}</span>
          <span class="hint-desc">${esc(desc)}</span>
        </div>
      `;
      suggestionBoxEl.classList.add('has-suggestions');
      return;
    }

    const html = matches.map((cmd, index) => {
      const meta = CMD_META[cmd] || {};
      const label = meta.label || cmd;
      const isSelected = index === selectedSuggestionIndex;
      return `<span class="cmd-token cmd-clickable suggestion-token ${isSelected ? 'is-selected' : ''}" data-cmd="${cmd}" data-tip="${meta.tip || cmd}">${label}[${cmd}]</span>`;
    }).join(' ');

    suggestionBoxEl.innerHTML = `<span class="suggestion-label">${UI_TEXT.SEARCH}:</span> ${html}`;
    suggestionBoxEl.classList.add('has-suggestions');
    */
    void matches;
    void selectedIndex;
  }

  function setZoom(scale) {
    const clampedScale = Math.min(Math.max(0.5, scale), 3.0);
    const container = document.getElementById('terminal-container');
    if (container) {
      container.style.setProperty('--terminal-scale', clampedScale);
      state.terminalScale = clampedScale;
    }
  }

  function adjustZoom(delta) {
    const currentScale = state.terminalScale || 1.0;
    const nextScale = currentScale + delta;
    setZoom(nextScale);
    setScale(nextScale, true);
  }

  function setGhostText(text) {
    if (!ghostTextEl) {
      return;
    }
    ghostTextEl.textContent = text || '';
  }

  function autoAdjustZoom() {
    const cssScale = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--terminal-scale')) || 1.0;
    setZoom(cssScale);
    setScale(cssScale, false);
  }

  function initZoom() {
    if (isManualScale()) {
      if (state.terminalScale) {
        setZoom(state.terminalScale);
      }
    } else {
      autoAdjustZoom();
    }

    window.addEventListener('keydown', (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        adjustZoom(0.1);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        adjustZoom(-0.1);
      } else if (event.key === '0') {
        event.preventDefault();
        setScale(1.0, false);
        setZoom(1.0);
        autoAdjustZoom();
      }
    });
  }

  return {
    adjustZoom,
    autoAdjustZoom,
    initBlinkingCursor,
    initTooltips,
    initZoom,
    setGhostText,
    setSuggestions,
    setZoom,
    syncCursorVisibility,
    updateCursorPosition
  };
}
