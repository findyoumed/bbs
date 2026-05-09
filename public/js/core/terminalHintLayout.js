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

  function createOverflowEntry(hiddenEntries) {
    const hiddenTokenSummary = [...hiddenEntries]
      .sort((left, right) => Number(left.dataset.entryIndex || '0') - Number(right.dataset.entryIndex || '0'))
      .map((entry) => entry.dataset.tokenText)
      .filter(Boolean)
      .join(', ');

    const entry = document.createElement('span');
    entry.className = 'cmd-entry cmd-entry-overflow';
    entry.dataset.priority = '999';
    entry.dataset.tokenText = `+${hiddenEntries.length}`;

    const sep = document.createElement('span');
    sep.className = 'cmd-sep';
    sep.textContent = ',';

    const token = document.createElement('span');
    token.className = 'cmd-token cmd-token-overflow cmd-clickable';
    token.textContent = `+${hiddenEntries.length}`;
    token.dataset.cmd = '+';
    token.dataset.tip = hiddenTokenSummary
      ? `숨김 명령 ${hiddenEntries.length}개: ${hiddenTokenSummary}`
      : '숨겨진 명령 펼치기';
    token.title = token.dataset.tip;

    entry.appendChild(token);
    entry.appendChild(sep);
    return entry;
  }

  function trimHintEntriesToFit() {
    if (!hintEl || !hintEl.classList.contains('has-cmd-tokens')) {
      return;
    }

    let hasOverflow = false;
    const lists = Array.from(hintEl.querySelectorAll('.cmd-entry-list'));
    lists.forEach((listEl) => {
      const overflowEntry = listEl.querySelector('.cmd-entry-overflow');
      if (overflowEntry) {
        overflowEntry.remove();
      }

      const entries = Array.from(listEl.children).filter((entry) => entry.classList.contains('cmd-entry'));
      entries.forEach((entry, index) => {
        entry.hidden = false;
        entry.dataset.entryIndex = String(index);
      });
      syncHintEntrySeparators(listEl);

      if (hintExpanded || hintEl.clientWidth <= 0 || hintEl.scrollWidth <= hintEl.clientWidth) {
        return;
      }

      const hideCandidates = entries
        .map((entry, index) => ({ entry, index, priority: Number(entry.dataset.priority || '50') }))
        .sort((left, right) => left.priority - right.priority || right.index - left.index);

      const hiddenEntries = [];
      for (const candidate of hideCandidates) {
        if (entries.filter((entry) => !entry.hidden).length <= 0) {
          break;
        }

        candidate.entry.hidden = true;
        hiddenEntries.push(candidate.entry);
        hasOverflow = true;

        const existingOverflow = listEl.querySelector('.cmd-entry-overflow');
        if (existingOverflow) {
          existingOverflow.remove();
        }

        listEl.appendChild(createOverflowEntry(hiddenEntries));
        syncHintEntrySeparators(listEl);

        if (hintEl.scrollWidth <= hintEl.clientWidth) {
          break;
        }
      }
    });

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
      const overflowEntry = listEl.querySelector('.cmd-entry-overflow');
      if (overflowEntry) {
        overflowEntry.remove();
      }
      const entries = Array.from(listEl.children).filter((entry) => entry.classList.contains('cmd-entry'));
      entries.forEach((entry) => {
        entry.hidden = false;
      });
      syncHintEntrySeparators(listEl);
    });
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
