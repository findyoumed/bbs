function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripLeadingAnsiLines(text, lineCount = 4) {
  return String(text || '').split('\n').slice(lineCount).join('\n');
}

function formatCurrentTime() {
  const now = new Date();
  const y = now.getFullYear(); // [LOG: 20260609_1130] 고정되었던 연도(1993)를 현재 연도로 변경
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// [LOG: 20260423_1420] 실시간 시계 업데이트 (1초 간격)
// [LOG_ID: 20260721_1520] 모바일도 PC와 동일하게 날짜까지 보이도록 통일(사용자 요청: "모바일화면
// 프로젝트 전체적으로... pc화면과 똑같이 날짜도 넣어줘. 모든 메뉴에서") — 더는 compact/full을
// 구분하지 않고 항상 풀포맷("YYYY-MM-DD HH:MM:SS")을 쓴다. data-layout-mode는 시계 포맷과
// 무관한 다른 레이아웃(칸 수 등) 판단에는 계속 쓰이므로 그대로 둔다.
if (typeof window !== 'undefined') {
  setInterval(() => {
    const clockEls = document.querySelectorAll('.retro-topbar-clock');
    if (clockEls.length > 0) {
      const fullTimeStr = formatCurrentTime();
      clockEls.forEach(el => {
        if (el.textContent !== fullTimeStr) {
          el.textContent = fullTimeStr;
        }
      });
    }
  }, 1000);
}

function extractTopbarModel(rows) {
  const topLine = String(rows?.[0] || '');
  const headerLine = String(rows?.[1] || '');
  const trimmedTopLine = topLine.trimEnd();

  // [LOG: 20260427_1220] Extract brand label from row 0 instead of hardcoding
  // Row 0 format: [Brand][Gap][Timestamp]
  // Since brand starts at index 0, we can take the text before the gap line (─)
  const brandMatch = topLine.match(/^([^─]+)/);
  const siteLabel = brandMatch ? brandMatch[1].trim() : '01410';

  const timestampMatch = topLine.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*$/);
  const shortTimeMatch = topLine.match(/(\d{2}:\d{2})\s*$/);
  const timestamp = timestampMatch
    ? timestampMatch[1] // [LOG: 20260609_1130] 1993 강제 변환 제거하고 실제 서버 연도 유지
    : (shortTimeMatch ? shortTimeMatch[1] : formatCurrentTime());
  // [LOG: 20260427_1240] Treat the 44-column mobile header as a dedicated compact topbar layout.
  const layoutMode = (!timestampMatch && shortTimeMatch) || trimmedTopLine.length <= 44
    ? 'compact'
    : 'full';

  const trimmedHeader = headerLine.trimEnd();
  const leftLabelMatch = trimmedHeader.trimStart().match(/^[A-Z0-9/_-]+/);
  const leftLabel = leftLabelMatch ? leftLabelMatch[0] : '';

  let remainder = trimmedHeader;
  if (leftLabel) {
    const leftIndex = trimmedHeader.indexOf(leftLabel);
    remainder = trimmedHeader.slice(leftIndex + leftLabel.length);
  }

  let rightLabel = '';
  const pageLabelMatch = remainder.match(/(\(\d{2}\/\d{2}\))\s*$/);
  if (pageLabelMatch) {
    rightLabel = pageLabelMatch[1];
    remainder = remainder.slice(0, pageLabelMatch.index);
  }

  return {
    siteLabel,
    timestamp,
    layoutMode,
    leftLabel,
    centerLabel: remainder.trim(),
    rightLabel
  };
}

// [LOG: 20260610_1354] Use text-based characters for horizontal lines to unify look with footer line
function buildTopbarHtml(model) {
  const siteLabel = escapeHtml(model?.siteLabel || 'PC통신동호회 01410');
  const timestamp = escapeHtml(model?.timestamp || '');
  const layoutMode = model?.layoutMode === 'compact' ? 'compact' : 'full';
  const layoutCols = layoutMode === 'compact' ? '44' : '80';
  const leftLabel = escapeHtml(model?.leftLabel || '');
  const centerLabel = escapeHtml(model?.centerLabel || '');
  const rightLabel = escapeHtml(model?.rightLabel || '');

  return `
<div class="retro-topbar retro-topbar--ansi" data-layout-mode="${layoutMode}" data-layout-cols="${layoutCols}">
  <div class="retro-topbar-row1">
    <a class="retro-topbar-left" href="/" data-menu-path="top" aria-label="초기화면으로 이동">${siteLabel}</a>
    <span class="retro-topbar-line">────────────────────────────────────────────────────────────────────────────────</span>
    <span class="retro-topbar-clock">${timestamp}</span>
  </div>
  <div class="retro-topbar-row2">
    <span class="retro-topbar-menu">${leftLabel || '&nbsp;'}</span>
    <span class="retro-topbar-center retro-topbar-menu">${centerLabel || '&nbsp;'}</span>
    <span class="retro-topbar-url">${rightLabel || '&nbsp;'}</span>
  </div>
  <div class="retro-topbar-hr">────────────────────────────────────────────────────────────────────────────────</div>
</div>`.trim();
}

export { buildTopbarHtml };

// [LOG_ID: 20260708_1030] ANSI 텍스트가 아니라 이미 완성된 HTML 본문(줄 단위로 색을 입혀 누적되는
// 실시간 트랜스크립트 화면 — 쪽지 쓰기, 글쓰기 라인 에디터 등)을 렌더링할 때 쓰는 상단바 래퍼.
// renderAnsiScreenWithTopbar와 동일한 DOM 구조(.ansi-screen > 상단바 + .ansi-screen-body)를 만들지만,
// 첫 4줄을 ANSI 텍스트에서 파싱하는 대신 모델(leftLabel/centerLabel 등)을 직접 받는다.
// 이 두 화면이 여태 상단바(로고 박스+실시간 시계) 없이 렌더링되어 다른 모든 화면과 이질적으로 보였다.
export function renderRawHtmlScreenWithTopbar({ leftLabel = '', centerLabel = '', rightLabel = '', bodyHtml = '', screenEl, isMobile = false }) {
  const layoutMode = isMobile ? 'compact' : 'full';
  const layoutCols = layoutMode === 'compact' ? '44' : '80';
  const model = {
    siteLabel: 'PC통신동호회 01410',
    timestamp: formatCurrentTime(),
    layoutMode,
    leftLabel,
    centerLabel,
    rightLabel
  };

  const html = `<div class="ansi-screen" data-layout-mode="${layoutMode}" data-layout-cols="${layoutCols}">${buildTopbarHtml(model)}<div class="ansi-screen-body">${bodyHtml}</div></div>`;

  if (screenEl) {
    screenEl.innerHTML = html;
  }

  return {
    html,
    screenNode: screenEl?.querySelector('.ansi-screen')
  };
}

export function renderAnsiScreenWithTopbar({ ansiText, ansiToHTML, screenEl }) {
  const fullRendered = ansiToHTML(ansiText);
  const model = extractTopbarModel(fullRendered.rows);
  const layoutMode = model?.layoutMode === 'compact' ? 'compact' : 'full';
  const layoutCols = layoutMode === 'compact' ? '44' : '80';
  const bodyText = stripLeadingAnsiLines(ansiText, 4).trimEnd();
  const bodyRendered = ansiToHTML(bodyText);

  const html = `<div class="ansi-screen" data-layout-mode="${layoutMode}" data-layout-cols="${layoutCols}">${buildTopbarHtml(model)}<div class="ansi-screen-body">${bodyRendered.html}</div></div>`;

  if (screenEl) {
    screenEl.innerHTML = html;
  }

  return {
    html,
    screenNode: screenEl?.querySelector('.ansi-screen'),
    rows: bodyRendered.rows,
    topbar: model,
    // [LOG: 20260426_0655] Provide a helper to render to a specific body container
    renderTo: (container) => {
      if (!container) return;
      container.innerHTML = html;
      return container.querySelector('.ansi-screen');
    }
  };
}

/**
 * Renders the screen with a topbar immediately, then the body sequentially.
 * [LOG: 20260426_1445] Evolve Mode: Added for authentic terminal scrolling feel.
 */
export async function renderAnsiScreenWithTopbarSequential({ ansiText, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender }) {
  const fullRendered = ansiToHTML(ansiText);
  const model = extractTopbarModel(fullRendered.rows);
  const layoutMode = model?.layoutMode === 'compact' ? 'compact' : 'full';
  const layoutCols = layoutMode === 'compact' ? '44' : '80';
  const bodyText = stripLeadingAnsiLines(ansiText, 4).trimEnd();
  const bodyRendered = ansiToHTML(bodyText);

  // [LOG_ID: 20260707_2300] 화면 전체(상단바+본문+하단 힌트/입력줄)가 위→아래로 한 번에 나오는 것처럼
  // 보이도록, 본문이 다 드러나고 새 footer 내용까지 준비되기 전까지는 하단 힌트/입력줄을 숨긴다.
  // visibility만 제어하므로 레이아웃 높이는 그대로 유지된다(20260706_2247의 "하단 프레임 고정" 원칙 유지) —
  // 이전 화면의 낡은 명령 목록이 새 본문 스트리밍 내내 보이는 문제도, footer가 갑자기 비는 문제도 없이,
  // 본문의 마지막 줄이 드러나는 순간과 같은 타이밍에 하단이 "다음 줄"처럼 자연스럽게 이어서 나타난다.
  const hintEl = typeof document !== 'undefined' ? document.getElementById('cmd-hint') : null;
  const promptRowEl = typeof document !== 'undefined' ? document.getElementById('terminal-prompt-row') : null;
  const footerEl = typeof document !== 'undefined' ? document.getElementById('terminal-footer') : null;
  // [LOG_ID: 20260707_2330] is-command-pending(제출 직후 대기 커서 표시)이
  // #cmd-hint/#terminal-prompt-row에 visibility:visible !important를 강제하고 있어, 인라인 스타일도
  // !important로 지정해야 이 숨김이 실제로 유지된다. important 없이는 스트리밍 도중(제출 ~80ms 후)
  // is-command-pending이 켜지는 순간 하단이 도로 보이며 이전 화면의 낡은 내용이 잠깐 노출됐다.
  if (hintEl) hintEl.style.setProperty('visibility', 'hidden', 'important');
  if (promptRowEl) promptRowEl.style.setProperty('visibility', 'hidden', 'important');
  // [LOG_ID: 20260708_1130] #terminal-footer의 ::before 구분선(힌트 바로 위 마지막 가로줄)은
  // hintEl/promptRowEl과 별개로 footer 자신에 그려지는 요소라, 위 두 줄만 숨겨서는 화면 전환 때마다
  // 이 구분선이 본문 스트리밍이 시작되기도 전부터 이미 떠 있었다 — 위→아래 순서로 나와야 할 PC통신
  // 화면에서 맨 마지막 줄(구분선)이 맨 먼저 보이는 역행이 발생. 가상 요소는 인라인 스타일로 직접
  // 제어할 수 없으므로 클래스를 토글해 CSS(::before)로 숨긴다.
  footerEl?.classList.add('is-divider-pending');

  // 1. Render Topbar immediately
  const topbarHtml = buildTopbarHtml(model);
  if (screenEl) {
    screenEl.innerHTML = `<div class="ansi-screen" data-layout-mode="${layoutMode}" data-layout-cols="${layoutCols}">${topbarHtml}<div class="ansi-screen-body"></div></div>`;
    // [LOG_ID: 20260710_1510] 화면이 실제로 교체되는 이 시점에 이전 화면의 알림 토스트("본문 전체를
    // 불러올 수 없는 기사입니다" 등) 잔상을 즉시 제거한다. 토스트는 3초 타이머로만 사라지므로 그 사이
    // 화면이 전환되면 새 화면 위에 계속 남는다. 뉴스 등 topbar 화면은 renderScreenSequential을
    // 하위 컨테이너+clear:false로 호출해 그쪽 소거 로직(20260710_1500)이 발동하지 않으므로 여기서 직접 지운다.
    if (typeof document !== 'undefined') {
      const notifyEl = document.getElementById('terminal-notification');
      if (notifyEl) {
        notifyEl.style.display = 'none';
        notifyEl.textContent = '';
      }
    }
  }
  const bodyContainer = screenEl?.querySelector('.ansi-screen-body');

  try {
    // 2. Render Body sequentially — reveal-in-place 방식.
    // [LOG: 20260706_2230] 모뎀 스트리밍 재활성화. 과거 footer jitter로 비활성화됐었으나(20260509),
    // 전체 레이아웃을 먼저 확정하고 줄 단위로 visibility만 해제하는 방식이라 footer가 밀리지 않는다.
    if (bodyContainer) {
      if (typeof renderScreenSequential === 'function') {
        const isPrintView = typeof state !== 'undefined' && state.serviceData?._printView === true;
        await renderScreenSequential(bodyRendered.html, {
          container: bodyContainer,
          clear: false,
          revealInPlace: true,
          scrollIntoView: !isPrintView
        });
      } else {
        bodyContainer.innerHTML = bodyRendered.html;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 3. 본문이 다 드러난 "후"에 새 footer 내용(힌트/프롬프트)을 채운다 — 아직 하단은 숨겨진 상태라
    // 콘텐츠가 바뀌는 과정이 사용자에게 보이지 않는다.
    if (typeof afterBodyRender === 'function') {
      await afterBodyRender();
    }
  } finally {
    // 4. 본문+footer 콘텐츠가 모두 준비된 시점에만 하단을 드러낸다. 중단/예외 시에도 하단이
    // 영영 숨겨진 채로 고착되지 않도록 게다가 post-write 외 화면에서는 display:none이 남지 않도록 보장한다.
    if (hintEl) hintEl.style.removeProperty('visibility');
    if (promptRowEl) {
      promptRowEl.style.removeProperty('visibility');
      if (typeof state === 'undefined' || state?.screen !== 'post-write') {
        promptRowEl.style.display = '';
      }
    }
    const globalCmdInput = document.getElementById('terminal-command-input');
    if (globalCmdInput && (typeof state === 'undefined' || state?.screen !== 'post-write')) {
      globalCmdInput.style.display = '';
    }
    footerEl?.classList.remove('is-divider-pending');
    // [LOG_ID: 20260710_1815] 스트리밍 완료 후 화면 스크롤을 원점(상단바)으로 복원한다.
    // 본문 스트리밍 중 scrollIntoView는 줄을 따라 내려가며 조상 스크롤러의 scrollTop도 함께
    // 내리는데, 작은 모바일 뷰포트에서는 본문(고정 줄 수)이 화면 영역보다 커서 렌더가 "아래로
    // 스크롤된 채" 끝났다 — 상단바(로고/시계 줄)가 화면 위로 밀려 잘린 채 고착되고 overflow가
    // hidden인 화면에서는 사용자가 되돌릴 방법도 없었다. 새 화면은 항상 맨 위부터 보여야 하는
    // PC통신 메타포에 맞춰 완료 시점에 원점으로 되돌린다(갈무리 모드는 창 스크롤 소관이라 제외 —
    // newsScreens가 window.scrollTo(0,0)로 별도 처리).
    if (screenEl && !(typeof state !== 'undefined' && state.serviceData?._printView === true)) {
      screenEl.scrollTop = 0;
      // [LOG_ID: 20260721_1545] 게시글 보기(post-view)는 "한 프레임 고정"에서 빠져나와 #terminal-screen
      // 자체가 더는 스크롤 컨테이너가 아니다(overflow:visible, 페이지 전체가 스크롤됨) — 그 상태에서
      // 스트리밍 중 scrollIntoView가 실제로 움직인 건 window/document인데, 위 screenEl.scrollTop=0은
      // 이제 아무것도 없는 스크롤 위치를 리셋하는 셈이라 효과가 없었다. 실제로 스크롤된 window도
      // 함께 원점으로 되돌린다(다른 화면은 body가 여전히 position:fixed라 원래 스크롤되지 않으므로
      // 이 호출이 안전한 no-op이다).
      window.scrollTo(0, 0);
    }
  }

  return {
    screenNode: screenEl?.querySelector('.ansi-screen'),
    topbar: model,
    rows: bodyRendered.rows
  };
}
