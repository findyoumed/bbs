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
if (typeof window !== 'undefined') {
  setInterval(() => {
    const clockEls = document.querySelectorAll('.retro-topbar-clock');
    if (clockEls.length > 0) {
      const timeStr = formatCurrentTime();
      clockEls.forEach(el => {
        if (el.textContent !== timeStr) {
          el.textContent = timeStr;
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
  // [LOG_ID: 20260707_2330] is-command-pending(제출 직후 대기 커서 표시)이
  // #cmd-hint/#terminal-prompt-row에 visibility:visible !important를 강제하고 있어, 인라인 스타일도
  // !important로 지정해야 이 숨김이 실제로 유지된다. important 없이는 스트리밍 도중(제출 ~80ms 후)
  // is-command-pending이 켜지는 순간 하단이 도로 보이며 이전 화면의 낡은 내용이 잠깐 노출됐다.
  if (hintEl) hintEl.style.setProperty('visibility', 'hidden', 'important');
  if (promptRowEl) promptRowEl.style.setProperty('visibility', 'hidden', 'important');

  // 1. Render Topbar immediately
  const topbarHtml = buildTopbarHtml(model);
  if (screenEl) {
    screenEl.innerHTML = `<div class="ansi-screen" data-layout-mode="${layoutMode}" data-layout-cols="${layoutCols}">${topbarHtml}<div class="ansi-screen-body"></div></div>`;
  }
  const bodyContainer = screenEl?.querySelector('.ansi-screen-body');

  try {
    // 2. Render Body sequentially — reveal-in-place 방식.
    // [LOG: 20260706_2230] 모뎀 스트리밍 재활성화. 과거 footer jitter로 비활성화됐었으나(20260509),
    // 전체 레이아웃을 먼저 확정하고 줄 단위로 visibility만 해제하는 방식이라 footer가 밀리지 않는다.
    if (bodyContainer) {
      if (typeof renderScreenSequential === 'function') {
        await renderScreenSequential(bodyRendered.html, {
          container: bodyContainer,
          clear: false,
          revealInPlace: true,
          scrollIntoView: true
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
    // 영영 숨겨진 채로 고착되지 않도록 finally에서 보장한다.
    if (hintEl) hintEl.style.removeProperty('visibility');
    if (promptRowEl) promptRowEl.style.removeProperty('visibility');
  }

  return {
    screenNode: screenEl?.querySelector('.ansi-screen'),
    topbar: model,
    rows: bodyRendered.rows
  };
}
