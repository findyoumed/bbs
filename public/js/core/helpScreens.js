import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';
import { CMD_META } from './commandService.js';
import { UI_TEXT } from './i18n.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

/**
 * helpScreens.js
 * [LOG: 20260428_1730] Dynamic multi-page help system.
 * [LOG: 20260428_1735] Purged advanced commands, simplified categories.
 */
export function createHelpScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    cmdInput,
    displayWidth,
    getCommandFooterText,
    isWideChar,
    screenEl,
    state,
    updateURL
  } = deps;
  const {
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    fitCell,
    truncateDisplayText
  } = createAnsiBuilderUtils({ displayWidth, isWideChar });

  const CAT_LABELS = {
    NAV: UI_TEXT.CAT_NAV,
    POST: UI_TEXT.CAT_POST,
    AUTH: UI_TEXT.CAT_AUTH,
    MEMO: UI_TEXT.CAT_MEMO,
    CHAT: UI_TEXT.CAT_CHAT,
    UI: UI_TEXT.CAT_UI
  };

  function normalizeHelpOptions(pageOrOptions = 1) {
    if (typeof pageOrOptions === 'boolean') {
      return {
        fromHistory: pageOrOptions,
        page: 1
      };
    }

    if (pageOrOptions && typeof pageOrOptions === 'object') {
      return {
        fromHistory: Boolean(pageOrOptions.fromHistory),
        page: Math.max(1, Number.parseInt(pageOrOptions.page, 10) || 1)
      };
    }

    return {
      fromHistory: false,
      page: Math.max(1, Number.parseInt(pageOrOptions, 10) || 1)
    };
  }

  /**
   * 전체 도움말 ANSI 생성 (페이징 지원)
   */
  function buildHelpAnsi(page = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const currentTab = state.helpTab || 'all';
    const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);

    // 1. 카테고리별 명령어 분류
    const categories = {};
    Object.entries(CMD_META).forEach(([cmd, meta]) => {
      if (['?', '/'].includes(cmd)) return;
      const cat = meta.cat || 'ETC';
      if (!categories[cat]) categories[cat] = [];

      // 동일한 설명(desc)을 가진 명령어들은 쉼표로 병합
      const existing = categories[cat].find(item => item.description === meta.desc);
      if (existing) {
        if (!existing.command.split(', ').includes(cmd)) {
          existing.command = `${existing.command}, ${cmd}`;
        }
        return;
      }

      let displayCmd = cmd;
      if (cmd === 'F') displayCmd = 'F, [ENTER]';
      categories[cat].push({ command: displayCmd, description: meta.desc || meta.label });
    });

    // 2. 전체 줄(Lines) 구성
    const helpLines = [];
    const buildHelpLineAdaptive = (cmd, desc) => {
      const cmdWidth = isMobile ? 12 : 22;
      return [
        ansiColor(14),
        fitCell(cmd, cmdWidth),
        ansiColor(15),
        truncateDisplayText(desc, targetCols - cmdWidth),
        ANSI_RESET
      ].join('');
    };

    ['NAV', 'POST', 'AUTH', 'MEMO', 'CHAT', 'UI'].forEach(cat => {
      if (categories[cat] && categories[cat].length > 0) {
        helpLines.push(ansiColor(11) + (CAT_LABELS[cat] || `[${cat}]`) + ANSI_RESET);
        categories[cat].forEach((row) => {
          helpLines.push(buildHelpLineAdaptive(row.command, row.description));
        });
        helpLines.push(''); // 카테고리 간 빈 줄
      }
    });

    // 3. 페이징 계산 (제목 제외 본문은 약 20줄씩 끊음)
    const linesPerPage = 20;
    const totalPages = Math.max(1, Math.ceil(helpLines.length / linesPerPage));
    const finalPage = Math.max(1, Math.min(requestedPage, totalPages));

    const pageSlice = helpLines.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);

    const parts = [
      buildTopHeader({ leftLabel: 'HELP', centerLabel: UI_TEXT.HELP }, buildPageLabel(finalPage, totalPages), targetCols),
      ...pageSlice
    ];

    while (parts.length < 24) parts.push('');
    return {
      text: parts.slice(0, 24).join('\n'),
      page: finalPage,
      totalPages
    };
  }

  function buildCommandHelpAnsi(cmdKey) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const meta = CMD_META[cmdKey.toUpperCase()];
    if (!meta) return null;

    const parts = [
      buildTopHeader({ leftLabel: 'HELP', centerLabel: `${UI_TEXT.HELP}: ${cmdKey.toUpperCase()}` }, buildPageLabel(1, 1), targetCols),
      '',
      `${ansiColor(11)}${UI_TEXT.COMMAND_NAME}: ${ansiColor(14)}${cmdKey.toUpperCase()}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.LABEL}: ${ansiColor(15)}${meta.label}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.DESCRIPTION}: ${ansiColor(15)}${truncateDisplayText(meta.desc || UI_TEXT.NO_DESCRIPTION, targetCols - 10)}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.USAGE}: ${ansiColor(14)}${truncateDisplayText(meta.tip, targetCols - 10)}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.CATEGORY}: ${ansiColor(15)}${CAT_LABELS[meta.cat] || meta.cat}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.LOGIN_REQUIRED_SHORT}: ${ansiColor(15)}${meta.login ? 'YES' : 'NO'}${ANSI_RESET}`,
      '',
      `${ansiColor(8)}${truncateDisplayText(UI_TEXT.HELP_TOOLTIP_HINT, targetCols - 4)}${ANSI_RESET}`
    ];

    while (parts.length < 24) parts.push('');
    return {
      text: parts.join('\n'),
      page: 1,
      totalPages: 1
    };
  }

  function buildHistoryAnsi() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    // [LOG: 20260429_0348] cmdHistory is stored newest-first by input/history services.
    // Keep /history aligned with command recall and palette ordering.
    const history = Array.isArray(state.cmdHistory) ? state.cmdHistory : [];
    const parts = [
      buildTopHeader({ leftLabel: 'HIST', centerLabel: UI_TEXT.HISTORY }, buildPageLabel(1, 1), targetCols),
      ansiColor(11) + `[${UI_TEXT.RECENT_COMMAND_HISTORY}]` + ANSI_RESET,
      ''
    ];

    if (history.length === 0) {
      parts.push(ansiColor(8) + `  (${UI_TEXT.NO_HISTORY})` + ANSI_RESET);
    } else {
      history.forEach((entry, idx) => {
        const cmd = typeof entry === 'string' ? entry : entry.cmd;
        const num = String(idx + 1).padStart(2, ' ');
        parts.push(` ${ansiColor(14)}${num}. ${ansiColor(15)}${truncateDisplayText(cmd, targetCols - 6)}${ANSI_RESET}`);
      });
    }

    while (parts.length < 24) {
      parts.push('');
    }

    return parts.join('\n');
  }

  async function showHelp(cmdKey = '', pageOrOptions = 1) {
    const { fromHistory, page } = normalizeHelpOptions(pageOrOptions);
    state.screen = 'help';

    let helpView;
    if (cmdKey && CMD_META[cmdKey.toUpperCase()]) {
      helpView = buildCommandHelpAnsi(cmdKey);
    } else {
      helpView = buildHelpAnsi(page);
    }

    state.page = helpView.page;
    state.helpTotalPages = helpView.totalPages;
    if (!fromHistory) {
      updateURL();
    }

    renderAnsiScreenWithTopbar({
      ansiText: helpView.text,
      ansiToHTML,
      screenEl
    });
    await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('help'));
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showHistory() {
    state.screen = 'history';
    updateURL();

    renderAnsiScreenWithTopbar({
      ansiText: buildHistoryAnsi(),
      ansiToHTML,
      screenEl
    });
    await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('history'));
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showHelp, showHistory };
}
