/**
 * [LOG: 20260426_0100] 서비스 화면 UI 유틸리티 (Service UI Utilities)
 * - 텍스트 노드 탐색, 위치 계산 및 핫스팟 레이어 생성 로직 모듈화
 */

export function createServiceUiUtils({ displayWidth }) {
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
    let remaining = Math.max(0, charOffset);
    for (const textNode of textNodes) {
      const length = textNode.textContent.length;
      if (remaining <= length) {
        return { node: textNode, offset: remaining };
      }
      remaining -= length;
    }
    const lastNode = textNodes[textNodes.length - 1];
    return lastNode ? { node: lastNode, offset: lastNode.textContent.length } : null;
  }

  function getLineTextOffsets(lineNode) {
    const source = String(lineNode?.textContent || '');
    const trimmedEnd = source.replace(/\s+$/g, '');
    const start = trimmedEnd.search(/\S/);
    const end = trimmedEnd.length;

    if (start === -1 || end <= start) return null;
    return { start, end, source, content: trimmedEnd.slice(start, end) };
  }

  function measureLineSegmentBounds(screenNode, lineNode, startChar, endChar) {
    if (!screenNode || !lineNode || typeof document === 'undefined') return null;

    const source = String(lineNode?.textContent || '');
    const clampedStart = Math.max(0, Math.min(Number(startChar) || 0, source.length));
    const clampedEnd = Math.max(clampedStart, Math.min(Number(endChar) || source.length, source.length));
    if (clampedEnd <= clampedStart) return null;

    const textNodes = collectTextNodes(lineNode);
    const startPos = resolveTextNodeOffset(textNodes, clampedStart);
    const endPos = resolveTextNodeOffset(textNodes, clampedEnd);
    if (!startPos || !endPos) return null;

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
    if (!rects.length) return null;

    const screenRect = screenNode.getBoundingClientRect();
    const lineRect = lineNode.getBoundingClientRect();

    // [LOG: 20260426_0835] CSS zoom/scale(1.25 등) 이중 확대 방지
    const scaleX = screenNode.offsetWidth > 0 ? screenRect.width / screenNode.offsetWidth : 1;
    const scaleY = screenNode.offsetHeight > 0 ? screenRect.height / screenNode.offsetHeight : 1;

    const rawLeft = Math.min(...rects.map((rect) => rect.left)) - screenRect.left;
    const rawRight = Math.max(...rects.map((rect) => rect.right)) - screenRect.left;
    const rawTop = lineRect.top - screenRect.top;

    return {
      left: Math.max(0, rawLeft / scaleX),
      top: rawTop / scaleY,
      width: Math.max(8, (rawRight - rawLeft) / scaleX),
      height: Math.max(lineRect.height / scaleY, 16)
    };
  }

  function measureServiceLineBounds(screenNode, lineNode) {
    if (!screenNode || !lineNode || typeof document === 'undefined') return null;
    const offsets = getLineTextOffsets(lineNode);
    if (!offsets) return null;
    return measureLineSegmentBounds(screenNode, lineNode, offsets.start, offsets.end);
  }

  function estimateServiceLineBounds(screenNode, lineNode) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const screenRect = screenNode.getBoundingClientRect();
    const lineRect = lineNode.getBoundingClientRect();

    // [LOG: 20260426_0835] CSS zoom/scale(1.25 등) 이중 확대 방지
    const scaleX = screenNode.offsetWidth > 0 ? screenRect.width / screenNode.offsetWidth : 1;
    const scaleY = screenNode.offsetHeight > 0 ? screenRect.height / screenNode.offsetHeight : 1;

    const offsets = getLineTextOffsets(lineNode);
    if (!offsets) {
      return {
        left: Math.max(0, (lineRect.left - screenRect.left) / scaleX),
        top: (lineRect.top - screenRect.top) / scaleY,
        width: 8,
        height: Math.max(lineRect.height / scaleY, 16)
      };
    }

    const cellWidth = Math.max(8, (lineRect.width || screenRect.width || (targetCols * 10)) / targetCols);
    const leftCells = Math.max(0, typeof displayWidth === 'function' ? displayWidth(offsets.source.slice(0, offsets.start)) : offsets.start);
    const widthCells = Math.max(1, typeof displayWidth === 'function' ? displayWidth(offsets.content) : offsets.content.length);

    return {
      left: Math.max(0, ((lineRect.left - screenRect.left) + (leftCells * cellWidth)) / scaleX),
      top: (lineRect.top - screenRect.top) / scaleY,
      width: Math.max(8, (widthCells * cellWidth) / scaleX),
      height: Math.max(lineRect.height / scaleY, 16)
    };
  }

  function createHotspotLayer() {
    const layer = document.createElement('div');
    layer.className = 'ansi-hotspot-layer';
    return layer;
  }

  function createHotspotButton(cmd, label, bounds) {
    const commandText = String(cmd ?? '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ansi-hotspot';
    button.dataset.cmd = commandText;
    // [LOG: 20260506_0907] Preserve the visible service menu/article number in the input line while executing.
    if (commandText.trim()) {
      button.dataset.cmdFill = commandText.trim();
    }
    button.setAttribute('aria-label', label || '');
    button.title = label || '';
    button.style.left = `${bounds.left}px`;
    button.style.top = `${bounds.top}px`;
    button.style.width = `${bounds.width}px`;
    button.style.height = `${bounds.height}px`;
    return button;
  }

  return {
    measureServiceLineBounds,
    estimateServiceLineBounds,
    measureLineSegmentBounds,
    createHotspotLayer,
    createHotspotButton
  };
}
