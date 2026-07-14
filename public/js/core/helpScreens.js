import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
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
    renderScreenSequential,
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
    truncateDisplayText,
    wrapAnsiText
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
  // [LOG_ID: 20260713_1230] 나우누리 GUIDE '명령어안내' 재현 — 분류 번호(0~6)를 골라
  // 해당 분류의 명령어만 볼 수 있다. 0(전체)이 기본값이라 기존 H 동작은 그대로다.
  const HELP_TAB_KEYS = ['NAV', 'POST', 'AUTH', 'MEMO', 'CHAT', 'UI'];

  function buildHelpAnsi(page = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const currentTab = HELP_TAB_KEYS.includes(state.helpTab) ? state.helpTab : 'all';
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
    // [LOG_ID: 20260714_1500] 종전엔 설명이 폭(56칸)을 넘으면 truncateDisplayText가 말줄임
    // 표시조차 없이 그냥 잘라버렸다 — LV(등급변경) 설명은 111칸이라 절반 넘게 유실되어
    // "회원 등급을 변경합니다. 게시글" 에서 뚝 끊기고 정작 중요한 등급 값 안내
    // "(1:일반회원, 2:특별회원, 99:운영자)"가 통째로 사라졌다(사용자 보고). 자르는 대신
    // wrapAnsiText로 줄바꿈해 두 번째 줄부터는 명령 칸만큼 들여써서 전체 내용을 보존한다.
    const buildHelpLineAdaptive = (cmd, desc) => {
      // [LOG: 20260707_1430] "Q, X, EXIT, BYE, LOGOUT"(23자)이 폭 22에서 공백 없이 잘려
      // "LOGOU로그아웃하고"처럼 설명과 붙던 문제: 폭을 24로 늘리고, 명령이 폭을 넘치면
      // 폭-1로 잘라 컬럼 사이 최소 1칸 간격을 보장한다.
      const cmdWidth = isMobile ? 12 : 24;
      const cmdCell = fitCell(truncateDisplayText(cmd, cmdWidth - 1), cmdWidth);
      const descLines = wrapAnsiText(desc, targetCols - cmdWidth);
      return descLines.map((line, idx) => [
        idx === 0 ? ansiColor(14) + cmdCell : ' '.repeat(cmdWidth),
        ansiColor(15),
        line,
        ANSI_RESET
      ].join(''));
    };

    const visibleTabs = currentTab === 'all' ? HELP_TAB_KEYS : [currentTab];
    visibleTabs.forEach(cat => {
      if (categories[cat] && categories[cat].length > 0) {
        helpLines.push(ansiColor(11) + (CAT_LABELS[cat] || `[${cat}]`) + ANSI_RESET);
        categories[cat].forEach((row) => {
          helpLines.push(...buildHelpLineAdaptive(row.command, row.description));
        });
        // [LOG: 20260623_1236] 카테고리 간 빈 줄 제거 → 세로 스크롤바 방지
      }
    });

    // [LOG_ID: 20260713_1230] 분류 목차 줄 — 숫자 입력으로 분류를 골라 본다 (나우누리 GUIDE식)
    const tabShortNames = { NAV: '이동', POST: '글', AUTH: '계정', MEMO: '쪽지', CHAT: '대화', UI: '화면' };
    const activeTabIndex = currentTab === 'all' ? 0 : HELP_TAB_KEYS.indexOf(currentTab) + 1;
    const tabTokens = ['0.전체', ...HELP_TAB_KEYS.map((key, i) => `${i + 1}.${tabShortNames[key]}`)];
    const renderTabToken = (token, index) => (index === activeTabIndex
      ? ansiColor(14) + token + ANSI_RESET
      : ansiColor(8) + token + ANSI_RESET);
    const tabHeaderLines = isMobile
      ? [
        ansiColor(11) + '분류선택: ' + ANSI_RESET + tabTokens.slice(0, 3).map(renderTabToken).join(' '),
        '          ' + tabTokens.slice(3).map((token, i) => renderTabToken(token, i + 3)).join(' ')
      ]
      : [ansiColor(11) + '분류선택: ' + ANSI_RESET + tabTokens.map(renderTabToken).join('  ')];

    // 3. 페이징 계산 (제목/분류 목차 제외 본문 줄 수만큼 끊음)
    // [LOG: 20260623_1236] 세로 스크롤바 방지 예산(총 23줄) 유지 — 분류 목차 줄만큼 차감
    const linesPerPage = 19 - tabHeaderLines.length;
    const totalPages = Math.max(1, Math.ceil(helpLines.length / linesPerPage));
    const finalPage = Math.max(1, Math.min(requestedPage, totalPages));

    const pageSlice = helpLines.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);

    const parts = [
      buildTopHeader({ leftLabel: 'HELP', centerLabel: UI_TEXT.HELP }, buildPageLabel(finalPage, totalPages), targetCols),
      ...tabHeaderLines,
      ...pageSlice
    ];

    // [LOG: 20260623_1236] 24→23줄로 축소하여 세로 스크롤바 방지
    while (parts.length < 23) parts.push('');
    return {
      text: parts.slice(0, 23).join('\n'),
      page: finalPage,
      totalPages
    };
  }

  // [LOG_ID: 20260714_1500] 설명(desc)이 길면(예: LV 111칸) 한 줄 폭을 넘어 잘리던 문제 —
  // truncateDisplayText 대신 wrapAnsiText로 줄바꿈해 라벨 폭만큼 이어지는 줄을 들여쓴다.
  function buildLabeledWrappedLines(label, text, textColorCode, width) {
    const prefix = `${label}: `;
    const prefixWidth = displayWidth(prefix);
    const lines = wrapAnsiText(text, Math.max(1, width - prefixWidth));
    return lines.map((line, idx) => [
      idx === 0 ? ansiColor(11) + prefix : ' '.repeat(prefixWidth),
      ansiColor(textColorCode),
      line,
      ANSI_RESET
    ].join(''));
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
      ...buildLabeledWrappedLines(UI_TEXT.DESCRIPTION, meta.desc || UI_TEXT.NO_DESCRIPTION, 15, targetCols),
      ...buildLabeledWrappedLines(UI_TEXT.USAGE, meta.tip, 14, targetCols),
      `${ansiColor(11)}${UI_TEXT.CATEGORY}: ${ansiColor(15)}${CAT_LABELS[meta.cat] || meta.cat}${ANSI_RESET}`,
      `${ansiColor(11)}${UI_TEXT.LOGIN_REQUIRED_SHORT}: ${ansiColor(15)}${meta.login ? 'YES' : 'NO'}${ANSI_RESET}`,
      '',
      `${ansiColor(8)}${truncateDisplayText(UI_TEXT.HELP_TOOLTIP_HINT, targetCols - 4)}${ANSI_RESET}`
    ];

    while (parts.length < 24) parts.push('');
    return {
      text: parts.slice(0, 24).join('\n'),
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

    // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
    // afterBodyRender에서 footer 내용을 채운 뒤에야 하단이 드러난다.
    await renderAnsiScreenWithTopbarSequential({
      ansiText: helpView.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('help'));
      }
    });
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showHistory() {
    state.screen = 'history';
    updateURL();

    // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다.
    await renderAnsiScreenWithTopbarSequential({
      ansiText: buildHistoryAnsi(),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('history'));
      }
    });
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showHelp, showHistory };
}
