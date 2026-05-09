import { CMD_META } from './commandService.js';

export function createTerminalHintMarkup(deps) {
  const { state, esc } = deps;

  function resolveCommandLabel(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    return String(labelOverride || CMD_META[normalizedCmd]?.label || normalizedCmd).trim();
  }

  function buildCommandToken(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    if (!normalizedCmd) {
      return '';
    }

    const meta = CMD_META[normalizedCmd] || {};
    const label = String(labelOverride || meta.label || normalizedCmd).trim();
    const defaultLabel = String(meta.label || normalizedCmd).trim();
    const tip = String(
      labelOverride && label !== defaultLabel
        ? `${label}[${normalizedCmd}]`
        : (meta.tip || normalizedCmd)
    ).trim();
    const dataAttr = meta.fill
      ? `data-cmd-fill="${esc(meta.fill)}"`
      : `data-cmd="${esc(normalizedCmd)}"`;
    const tokenText = normalizedCmd === label.toUpperCase()
      ? esc(label)
      : `${esc(label)}[${esc(normalizedCmd)}]`;
    return `<span class="cmd-token cmd-clickable" data-tip="${esc(tip)}" ${dataAttr}>${tokenText}</span>`;
  }

  function buildParenCommandToken(labelOverride, cmd) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const label = String(labelOverride || '').trim();
    if (!normalizedCmd || !label || !CMD_META[normalizedCmd]) {
      return '';
    }

    const meta = CMD_META[normalizedCmd] || {};
    const dataAttr = meta.fill
      ? `data-cmd-fill="${esc(meta.fill)}"`
      : `data-cmd="${esc(normalizedCmd)}"`;
    const tip = String(meta.tip || `${label}[${normalizedCmd}]`).trim();

    return `<span class="cmd-token cmd-clickable" data-tip="${esc(tip)}" ${dataAttr}>${esc(label)}(${esc(normalizedCmd)})</span>`;
  }

  function getCommandTokenText(cmd, labelOverride = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const label = resolveCommandLabel(normalizedCmd, labelOverride);
    return normalizedCmd === label.toUpperCase()
      ? label
      : `${label}[${normalizedCmd}]`;
  }

  function getCommandPriority(cmd) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    return Number(CMD_META[normalizedCmd]?.priority ?? 50);
  }

  function buildCommandEntry(cmd, labelOverride = '') {
    const tokenText = getCommandTokenText(cmd, labelOverride);
    const priority = getCommandPriority(cmd);
    return `<span class="cmd-entry" data-priority="${priority}" data-token-text="${esc(tokenText)}">${buildCommandToken(cmd, labelOverride)}<span class="cmd-sep">,</span></span>`;
  }

  function getFooterTokenBucket(cmd, label = '') {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const resolvedLabel = resolveCommandLabel(normalizedCmd, label);

    if (['F', 'B', 'L'].includes(normalizedCmd)) return 10;
    if (normalizedCmd === 'N') return resolvedLabel === '이전글' ? 10 : 50;
    if (normalizedCmd === 'A') return resolvedLabel === '다음글' ? 10 : 50;
    if (['P', 'M', 'Z'].includes(normalizedCmd)) return 20;
    if (normalizedCmd === 'T') return 30;
    if (normalizedCmd === 'GO') return 40;
    if (['LOGIN', 'WHO', 'PF', 'HI', 'MYINFO'].includes(normalizedCmd)) return 60;
    if (['H', 'HELP', '?'].includes(normalizedCmd)) return 70;
    return 50;
  }

  function sortFooterTokens(tokens) {
    return [...tokens]
      .map((token, index) => ({ ...token, index }))
      .sort((left, right) => {
        const bucketDiff = getFooterTokenBucket(left.cmd, left.label) - getFooterTokenBucket(right.cmd, right.label);
        if (bucketDiff !== 0) {
          return bucketDiff;
        }
        return left.index - right.index;
      })
      .map(({ index, ...token }) => token);
  }

  function getFooterPageState() {
    if (state.screen === 'help') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.helpTotalPages || 1))
      };
    }

    if (state.screen === 'post-list') {
      return {
        pageNo: Math.max(1, Number(state.page || 1)),
        pageCount: Math.max(1, Number(state.totalPages || 1))
      };
    }

    return {
      pageNo: Math.max(1, Number(state.serviceData?.pageNo || 1)),
      pageCount: Math.max(1, Number(state.serviceData?.pageCount || 1))
    };
  }

  function shouldShowFooterToken(cmd, label, allTokens) {
    const normalizedCmd = String(cmd || '').trim().toUpperCase();
    const resolvedLabel = resolveCommandLabel(normalizedCmd, label);
    const defaultLabel = resolveCommandLabel(normalizedCmd, '');
    const usesCustomLabel = Boolean(label) && resolvedLabel !== defaultLabel;

    if (['X', 'Z', 'M'].includes(normalizedCmd)) return false;
    if (normalizedCmd === 'H' && state.screen === 'help') return false;
    if (normalizedCmd === 'LOGIN' && !state.user?.isGuest) return false;

    const meta = CMD_META[normalizedCmd];
    if (meta?.login && state.user?.isGuest && !usesCustomLabel) return false;

    if ((resolvedLabel === '이전글' || resolvedLabel === '다음글') && state.screen !== 'post-view') return false;

    if (normalizedCmd === 'P' && allTokens.some((token) => token.cmd === 'B' && resolveCommandLabel(token.cmd, token.label) === '상위')) {
      return false;
    }

    if (normalizedCmd === 'B' && (resolvedLabel === '이전쪽' || resolvedLabel === '이전')) {
      const { pageNo } = getFooterPageState();
      if (pageNo <= 1) return false;
    }

    if (normalizedCmd === 'F' && (resolvedLabel === '다음쪽' || resolvedLabel === '다음')) {
      const { pageNo, pageCount } = getFooterPageState();
      if (pageNo >= pageCount) return false;
    }

    return true;
  }

  function renderHintMarkup(text) {
    const placeholders = [];
    const stash = (html) => {
      const key = `@@CMDTOKEN${placeholders.length}@@`;
      placeholders.push({ key, html });
      return key;
    };

    let source = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim() !== '>>')
      .join('\n')
      .trim();

    source = source.replace(/번호\/명령\(([^)]*)\)/g, (_, inner) => {
      const tokens = [];
      const tokenPattern = /([A-Z0-9]{1,8})(?::([^\s,()]+))?/g;
      let match;
      while ((match = tokenPattern.exec(inner)) !== null) {
        tokens.push({ cmd: match[1].toUpperCase(), label: match[2] || '' });
      }

      const visibleTokens = sortFooterTokens(
        tokens.filter((token) => shouldShowFooterToken(token.cmd, token.label, tokens))
      );
      const renderedInner = visibleTokens
        .map((token) => stash(buildCommandEntry(token.cmd, token.label)))
        .join('');

      return stash(`<span class="cmd-entry-list">${renderedInner}</span>`);
    });

    source = source.replace(/\{\{([^|{}]+)\|([A-Z0-9]{1,8})\}\}/g, (_, label, cmd) => {
      return stash(buildCommandToken(cmd, label));
    });

    source = source.replace(/([가-힣A-Za-z0-9_]+)\(([A-Z0-9]{1,8})\)/g, (match, label, cmd) => {
      const token = buildParenCommandToken(label, cmd);
      return token ? stash(token) : match;
    });

    source = source.replace(/\b([A-Z]{1,8}):([^\s,()<>]{1,10})/g, (match, cmd, label) => {
      if (cmd === 'HTTP' || cmd === 'HTTPS') {
        return match;
      }
      return stash(buildCommandToken(cmd, label));
    });

    let html = esc(source).replace(/\n/g, '<br>');
    [...placeholders].reverse().forEach(({ key, html: tokenHtml }) => {
      html = html.split(key).join(tokenHtml);
    });

    return html;
  }

  return {
    renderHintMarkup
  };
}
