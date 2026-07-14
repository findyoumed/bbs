import { ANSI_COLS, ANSI_ROWS, displayWidth, isWideChar } from './ansiRenderUtils.js';

function findMenuLabelEnd(text, startIdx) {
  let endIdx = startIdx;
  let spaceRun = 0;

  for (let i = startIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '·') break;
    if (ch === ' ') {
      spaceRun += 1;
      if (spaceRun >= 2) {
        // [LOG_ID: 20260715_2000] GUIDE처럼 라벨-코드 사이를 여러 칸 정렬 공백으로 채우는
        // 화면(buildBoardSelectAnsi의 labelColWidth 패딩)에서는 공백 2칸 규칙이 "(코드)"
        // 표기까지 잘라내 호버/클릭 영역에서 빠뜨렸다(사용자 보고: guide 호버링 영역이
        // 이상함). 공백 뒤 남은 내용이 "(코드)" 하나뿐이면 라벨의 일부로 포함시킨다.
        const tail = text.slice(i);
        const codeMatch = tail.match(/^\s*(\([^)]+\))\s*$/);
        if (codeMatch) {
          return i + tail.indexOf(codeMatch[1]) + codeMatch[1].length;
        }
        break;
      }
      continue;
    }
    spaceRun = 0;
    endIdx = i;
  }

  return endIdx + 1;
}

function hasOverlappingHotspot(hotspots, row, startCol, endCol) {
  return hotspots.some((hotspot) => {
    if (hotspot.row !== row) {
      return false;
    }
    return startCol < hotspot.endCol && endCol > hotspot.startCol;
  });
}

export function buildMenuHotspotsFromRows(rows, entries, compareDoor) {
  const entryMap = new Map(
    (entries || [])
      .filter((entry) => String(entry?.door || '').trim())
      .map((entry) => [String(entry.door).trim(), entry])
  );
  const doors = Array.from(entryMap.keys())
    .sort((left, right) => right.length - left.length || compareDoor(left, right));
  const hotspots = [];

  rows.forEach((rowText, rowIndex) => {
    // 1. 숫자 기반 메뉴 패턴 감지 (1. 메뉴명)
    for (const door of doors) {
      const marker = `${door}. `;
      let textIdx = rowText.indexOf(marker);

      while (textIdx !== -1) {
        const before = textIdx === 0 ? ' ' : rowText[textIdx - 1];
        if (/\s/.test(before) || before === '·') {
          const endTextIdx = findMenuLabelEnd(rowText, textIdx);
          const startCol = displayWidth(rowText.slice(0, textIdx));
          const endCol = startCol + displayWidth(rowText.slice(textIdx, endTextIdx));
          const entry = entryMap.get(door);
          hotspots.push({
            row: rowIndex,
            startCol,
            endCol: Math.max(startCol + marker.length, endCol),
            inputValue: door,
            nodeKey: entry?.nodeKey || '',
            boardId: entry?.action === 'board' ? entry.boardId : '',
            menuPath: entry?.action === 'menu' ? entry.menuPath : '',
            cmd: entry?.action === 'cmd' ? entry.cmd : '',
            label: entry?.title || entry?.label || `${door}번 메뉴`
          });
        }
        textIdx = rowText.indexOf(marker, textIdx + marker.length);
      }
    }

    // [LOG_ID: 20260715_0930] 이 행에 이미 번호 기반 메뉴 항목 핫스팟이 있으면, 뒤따르는
    // "(코드)" 표기는 그 항목 자신의 코드다 — 아래 전역 명령어 패턴과 별개로 취급해야 한다.
    // GUIDE의 "4. 이용약관 (TOS)"처럼 코드가 우연히 1~3글자(TOS)면 전역 명령 패턴과 혼동되어
    // "이용약관" 버튼과 겹치는 자리에 "명령 실행: TOS"라는 엉뚱한 핫스팟이 별도로 생겨,
    // 그 부분만 클릭해도 메뉴 이동 대신 존재하지도 않는 TOS 명령이 실행되는 문제가 있었다
    // (사용자 보고: guide 화면 호버·클릭 영역이 다른 메뉴와 다름).
    const rowHasMenuItemHotspot = hotspots.some((h) => h.row === rowIndex && (h.nodeKey || h.boardId || h.menuPath));

    // 2. [LOG: 20260410_2325] 괄호 명령어 패턴 감지 (예: (P), (T), (Q))
    const parenRegex = /\(([^)]+)\)/g;
    let match;
    while (!rowHasMenuItemHotspot && (match = parenRegex.exec(rowText)) !== null) {
      const inner = match[1];
      // 괄호 안이 1~3글자의 대문자(명령어 후보)인 경우
      if (/^[A-Z]{1,3}$/.test(inner)) {
        const startCol = displayWidth(rowText.slice(0, match.index));
        const endCol = startCol + displayWidth(match[0]);
        if (hasOverlappingHotspot(hotspots, rowIndex, startCol, endCol)) {
          continue;
        }
        hotspots.push({
          row: rowIndex,
          startCol,
          endCol,
          inputValue: inner,
          cmd: inner,
          label: `명령 실행: ${inner}`
        });
      }
    }

    // [LOG_ID: 20260713_1060] (GO [이름]) 괄호 명령어 패턴 감지 (예: (GO NOTICE))
    const goRegex = /\(GO\s+([A-Z0-9_-]+)\)/gi;
    let goMatch;
    while ((goMatch = goRegex.exec(rowText)) !== null) {
      const targetName = goMatch[1].toUpperCase();
      const startCol = displayWidth(rowText.slice(0, goMatch.index));
      const endCol = startCol + displayWidth(goMatch[0]);
      if (hasOverlappingHotspot(hotspots, rowIndex, startCol, endCol)) {
        continue;
      }
      hotspots.push({
        row: rowIndex,
        startCol,
        endCol,
        inputValue: `GO ${targetName}`,
        cmd: `GO ${targetName}`,
        label: `이동: GO ${targetName}`
      });
    }

    // 3. 외부 링크(URL) 패턴 감지
    const urlRegex = /https?:\/\/[^\s]+/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(rowText)) !== null) {
      const url = urlMatch[0];
      const startCol = displayWidth(rowText.slice(0, urlMatch.index));
      const endCol = startCol + displayWidth(url);
      if (hasOverlappingHotspot(hotspots, rowIndex, startCol, endCol)) {
        continue;
      }
      hotspots.push({
        row: rowIndex,
        startCol,
        endCol,
        url: url,
        label: `외부 링크 열기: ${url}`
      });
    }
  });

  return hotspots;
}

function charOffsetFromDisplayCol(text, targetCol) {
  const source = String(text || '');
  let displayCol = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (displayCol >= targetCol) {
      return index;
    }
    displayCol += isWideChar(source[index]) ? 2 : 1;
  }

  return source.length;
}

function collectTextNodes(root) {
  const nodes = [];
  if (!root || typeof document === 'undefined') return nodes;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}

function resolveTextNodeOffset(textNodes, charOffset) {
  if (!textNodes.length) return null;

  let remaining = Math.max(0, charOffset);
  for (const textNode of textNodes) {
    const length = textNode.textContent.length;
    if (remaining <= length) {
      return { node: textNode, offset: remaining };
    }
    remaining -= length;
  }

  const lastNode = textNodes[textNodes.length - 1];
  return { node: lastNode, offset: lastNode.textContent.length };
}

function measureHotspotBounds(screenNode, lineNode, hotspot) {
  if (!screenNode || !lineNode || typeof document === 'undefined') return null;

  const lineText = lineNode.textContent || '';
  const startChar = charOffsetFromDisplayCol(lineText, hotspot.startCol);
  const endChar = charOffsetFromDisplayCol(lineText, hotspot.endCol);
  if (endChar <= startChar) return null;

  const textNodes = collectTextNodes(lineNode);
  const startPos = resolveTextNodeOffset(textNodes, startChar);
  const endPos = resolveTextNodeOffset(textNodes, endChar);
  if (!startPos || !endPos) return null;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const textRects = Array.from(range.getClientRects());
  if (!textRects.length) return null;

  const screenRect = screenNode.getBoundingClientRect();
  const lineRect = lineNode.getBoundingClientRect();
  
  // [LOG: 20260426_0835] CSS zoom/scale(1.25 등) 적용 시 이중 확대를 방지하기 위해 스케일 비율 계산
  const scaleX = screenNode.offsetWidth > 0 ? screenRect.width / screenNode.offsetWidth : 1;
  const scaleY = screenNode.offsetHeight > 0 ? screenRect.height / screenNode.offsetHeight : 1;

  const rawLeft = Math.min(...textRects.map((rect) => rect.left)) - screenRect.left;
  const rawRight = Math.max(...textRects.map((rect) => rect.right)) - screenRect.left;
  const rawTop = lineRect.top - screenRect.top;
  
  const left = rawLeft / scaleX;
  const top = rawTop / scaleY;
  const width = Math.max(8, (rawRight - rawLeft) / scaleX);
  const height = Math.max(lineRect.height / scaleY, 16);

  return { left, top, width, height };
}

export function renderMenuHotspots(screenNode, hotspots) {
  if (!screenNode || !Array.isArray(hotspots) || !hotspots.length) return;

  const lineNodes = Array.from(screenNode.querySelectorAll('.ansi-line'));
  const layer = document.createElement('div');
  layer.className = 'ansi-hotspot-layer';
  const positionedButtons = [];

  function applyBounds(button, hotspot) {
    const bounds = measureHotspotBounds(screenNode, lineNodes[hotspot.row], hotspot);
    if (bounds) {
      button.style.left = `${bounds.left}px`;
      button.style.top = `${bounds.top}px`;
      button.style.width = `${bounds.width}px`;
      button.style.height = `${bounds.height}px`;
    } else {
      button.style.left = `${(hotspot.startCol / ANSI_COLS) * 100}%`;
      button.style.top = `${(hotspot.row / ANSI_ROWS) * 100}%`;
      button.style.width = `${((hotspot.endCol - hotspot.startCol) / ANSI_COLS) * 100}%`;
      button.style.height = `${(1 / ANSI_ROWS) * 100}%`;
    }
  }

  function refreshBounds() {
    if (!screenNode.isConnected) return;
    positionedButtons.forEach(({ button, hotspot }) => applyBounds(button, hotspot));
  }

  function findFallbackButtonForClick(event) {
    const screenRect = screenNode.getBoundingClientRect();
    if (
      event.clientX < screenRect.left ||
      event.clientX > screenRect.right ||
      event.clientY < screenRect.top ||
      event.clientY > screenRect.bottom
    ) {
      return null;
    }

    const rowMatches = positionedButtons.filter(({ hotspot }) => {
      const lineNode = lineNodes[hotspot.row];
      if (!lineNode) return false;
      const rect = lineNode.getBoundingClientRect();
      return event.clientY >= rect.top - 4 && event.clientY <= rect.bottom + 4;
    });

    if (!rowMatches.length) return null;

    for (const { button } of rowMatches) {
      const rect = button.getBoundingClientRect();
      if (event.clientX >= rect.left - 8 && event.clientX <= rect.right + 8) {
        return button;
      }
    }

    if (rowMatches.length === 1) {
      return rowMatches[0].button;
    }

    return null;
  }

  hotspots.forEach((hotspot) => {
    if (!hotspot.nodeKey && !hotspot.boardId && !hotspot.menuPath && !hotspot.cmd && !hotspot.url) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ansi-hotspot';
    if (hotspot.nodeKey) button.dataset.nodeKey = hotspot.nodeKey;
    if (hotspot.boardId) button.dataset.boardId = hotspot.boardId;
    if (hotspot.menuPath) button.dataset.menuPath = hotspot.menuPath;
    if (hotspot.cmd) button.dataset.cmd = hotspot.cmd;
    if (hotspot.inputValue) button.dataset.cmdFill = hotspot.inputValue;
    if (hotspot.url) button.dataset.externalUrl = hotspot.url;
    button.setAttribute('aria-label', hotspot.label);
    button.title = hotspot.label;

    positionedButtons.push({ button, hotspot });
    applyBounds(button, hotspot);
    layer.appendChild(button);
  });

  if (layer.childElementCount > 0) {
    screenNode.appendChild(layer);

    screenNode.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.target.closest('button, a, input, textarea, select, [data-node-key], [data-board-id], [data-menu-path], [data-cmd], [data-external-url]')) return;

      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      const fallbackButton = findFallbackButtonForClick(event);
      if (!fallbackButton) return;

      event.preventDefault();
      event.stopPropagation();
      fallbackButton.click();
    });

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(refreshBounds);
    }

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(refreshBounds).catch(() => {});
    }

    window.setTimeout(refreshBounds, 500);
    window.setTimeout(refreshBounds, 1500);
  }
}
