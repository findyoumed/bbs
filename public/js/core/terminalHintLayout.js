export function createTerminalHintLayout(deps) {
  const { hintEl } = deps;

  let hintExpanded = false;

  function resetHintExpansion() {
    hintExpanded = false;
    if (!hintEl) {
      return;
    }
    hintEl.classList.remove('is-expanded');
    hintEl.dataset.hintExpandable = 'false';
  }

  function syncHintEntrySeparators(listEl) {
    if (!listEl) {
      return;
    }

    const visibleEntries = Array.from(listEl.children).filter((entry) => !entry.hidden);
    Array.from(listEl.children).forEach((entry) => entry.classList.remove('cmd-entry--last-visible'));
    if (visibleEntries.length > 0) {
      visibleEntries[visibleEntries.length - 1].classList.add('cmd-entry--last-visible');
    }
  }

  // [LOG: 20260622_1900] 사용자 선택: 넘칠 때 '+N' 토큰 대신 숨긴 명령을 도움말(H) 토큰 tooltip에 모은다.
  const HELP_TOKEN_SELECTOR = '.cmd-token[data-cmd="H"], .cmd-token[data-cmd="HELP"], .cmd-token[data-cmd="?"]';

  function findHelpToken() {
    return hintEl ? hintEl.querySelector(HELP_TOKEN_SELECTOR) : null;
  }

  // 숨겨진 엔트리 목록을 도움말(H) 토큰 tooltip에 노출한다. 비어 있으면 원래 tooltip으로 복원.
  function applyHiddenCommandsToHelpToken(hiddenEntries) {
    const helpToken = findHelpToken();
    if (!helpToken) {
      return;
    }
    if (helpToken.dataset.defaultTip === undefined) {
      helpToken.dataset.defaultTip = helpToken.dataset.tip || '';
    }

    if (!hiddenEntries.length) {
      helpToken.dataset.tip = helpToken.dataset.defaultTip;
      helpToken.title = helpToken.dataset.defaultTip;
      return;
    }

    const summary = [...hiddenEntries]
      .sort((left, right) => Number(left.dataset.entryIndex || '0') - Number(right.dataset.entryIndex || '0'))
      .map((entry) => entry.dataset.tokenText)
      .filter(Boolean)
      .join(', ');

    const tip = summary ? `이 화면의 다른 명령 — ${summary}` : helpToken.dataset.defaultTip;
    helpToken.dataset.tip = tip;
    helpToken.title = tip;
  }

  // [LOG: 20260622_1900] 힌트 토큰 목록은 inline-flex; flex-wrap:wrap 이라 넘치면 가로가 아니라 "다음 줄"로
  // 줄바꿈된다. 따라서 scrollWidth>clientWidth(가로 overflow)로는 넘침을 감지할 수 없다.
  // 보이는 엔트리들이 2줄 이상으로 퍼졌는지(= 첫 줄보다 아래에 있는 엔트리 존재)로 한 줄 초과를 판정한다.
  function listOverflowsLine(listEl) {
    const visible = Array.from(listEl.children)
      .filter((entry) => entry.classList.contains('cmd-entry') && !entry.hidden);
    if (visible.length < 2) {
      return false;
    }
    const firstTop = Math.round(visible[0].getBoundingClientRect().top);
    return visible.some((entry) => Math.round(entry.getBoundingClientRect().top) > firstTop + 2);
  }

  function trimHintEntriesToFit() {
    if (!hintEl || !hintEl.classList.contains('has-cmd-tokens')) {
      return;
    }

    let hasOverflow = false;
    const hiddenEntries = [];
    const lists = Array.from(hintEl.querySelectorAll('.cmd-entry-list'));
    lists.forEach((listEl) => {
      const entries = Array.from(listEl.children).filter((entry) => entry.classList.contains('cmd-entry'));
      entries.forEach((entry, index) => {
        entry.hidden = false;
        entry.dataset.entryIndex = String(index);
      });
      syncHintEntrySeparators(listEl);

      if (hintExpanded || hintEl.clientWidth <= 0 || !listOverflowsLine(listEl)) {
        return;
      }

      // 도움말(H) 토큰이 든 엔트리는 숨기지 않는다 — 숨긴 명령 tooltip의 진입점이므로 항상 보이게 유지.
      const hideCandidates = entries
        .filter((entry) => !entry.querySelector(HELP_TOKEN_SELECTOR))
        .map((entry) => ({ entry, index: Number(entry.dataset.entryIndex || '0'), priority: Number(entry.dataset.priority || '50') }))
        .sort((left, right) => left.priority - right.priority || right.index - left.index);

      for (const candidate of hideCandidates) {
        if (!listOverflowsLine(listEl)) {
          break;
        }
        candidate.entry.hidden = true;
        hiddenEntries.push(candidate.entry);
        hasOverflow = true;
        syncHintEntrySeparators(listEl);
      }
    });

    applyHiddenCommandsToHelpToken(hiddenEntries);
    hintEl.dataset.hintExpandable = hasOverflow ? 'true' : 'false';
  }

  function setHintExpanded(expanded) {
    if (!hintEl || !hintEl.classList.contains('has-cmd-tokens')) {
      return false;
    }

    if (!expanded) {
      hintExpanded = false;
      hintEl.classList.remove('is-expanded');
      trimHintEntriesToFit();
      return true;
    }

    if (hintEl.dataset.hintExpandable !== 'true') {
      return false;
    }

    hintExpanded = true;
    hintEl.classList.add('is-expanded');
    const lists = Array.from(hintEl.querySelectorAll('.cmd-entry-list'));
    lists.forEach((listEl) => {
      const entries = Array.from(listEl.children).filter((entry) => entry.classList.contains('cmd-entry'));
      entries.forEach((entry) => {
        entry.hidden = false;
      });
      syncHintEntrySeparators(listEl);
    });
    // 전부 펼쳤으니 도움말(H) tooltip은 원래 설명으로 복원.
    applyHiddenCommandsToHelpToken([]);
    return true;
  }

  function toggleHintExpansion() {
    return setHintExpanded(!hintExpanded);
  }

  return {
    resetHintExpansion,
    toggleHintExpansion,
    trimHintEntriesToFit
  };
}
