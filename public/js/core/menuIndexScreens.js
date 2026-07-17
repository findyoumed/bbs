import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

/**
 * [LOG_ID: 20260716_1600] 하이텔 원전 (1)서비스안내-6.메뉴안내(menu)/8.인덱스안내(index).
 *
 * GO 명령은 예전부터 있었지만 "어떤 키워드를 쓸 수 있는지" 한눈에 볼 화면이 없었다.
 * 각 메뉴 화면이 자기 항목의 (코드)를 보여주긴 하지만, 전체를 알려면 서브메뉴 4곳을
 * 일일이 들어가 봐야 했다(TOP에는 11개만 보이고 나머지 19개는 안쪽에 있다).
 * 이 화면은 살아있는 메뉴 트리(state.menuTree)에서 매번 새로 만들어지므로 낡거나
 * 비지 않는다 — 별도 데이터·API가 없다.
 */
export function createMenuIndexScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    cmdInput,
    displayWidth,
    getCommandFooterText,
    getMenuChildren,
    getMenuNodeLabel,
    isWideChar,
    loadMenuTree,
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
    truncateDisplayText
  } = createAnsiBuilderUtils({ displayWidth, isWideChar });

  // 이름 끝의 괄호 코드는 떼어낸다 — 코드 칸에서 따로 보여주므로 "서비스안내 (GUIDE) GUIDE"처럼
  // 겹쳐 보이지 않게 한다.
  function toLabelText(node) {
    const label = getMenuNodeLabel(node);
    return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
  }

  // 코드 칸에는 GO가 실제로 해석하는 값(node.go)을 그대로 쓴다. menuService.getMenuNodeCode()는
  // 10자가 넘는 코드를 숨기지만(화면 미관), 인덱스는 키워드를 알려주는 게 목적이라 PDS_GRAPHIC처럼
  // 긴 값도 그대로 노출해야 한다.
  function toGoCode(node) {
    const code = String(node?.go || '').trim().toUpperCase();
    return code === 'TOP' ? '' : code;
  }

  function buildMenuIndexAnsi(page = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);

    const labelWidth = isMobile ? 16 : 34;
    const codeWidth = isMobile ? 12 : 14;

    const buildRow = (node, depth) => {
      const indent = ' '.repeat(depth === 0 ? 2 : 4);
      const door = `${String(node?.door || '').trim()}.`;
      const width = labelWidth - (depth === 0 ? 0 : 2);
      const label = fitCell(truncateDisplayText(toLabelText(node), width - 1), width);
      const code = fitCell(toGoCode(node), codeWidth);
      const nameColor = depth === 0 ? ansiColor(15) : ansiColor(7);
      return `${indent}${ansiColor(11)}${fitCell(door, 3, 'right')}${ANSI_RESET} ${nameColor}${label}${ANSI_RESET}${ansiColor(14)}${code}${ANSI_RESET}`;
    };

    const rows = [];
    getMenuChildren(state.menuTree).forEach((top) => {
      rows.push(buildRow(top, 0));
      getMenuChildren(top).forEach((child) => rows.push(buildRow(child, 1)));
    });

    const guideLine = isMobile
      ? `${ansiColor(8)}  코드 입력 시 바로 이동합니다.${ANSI_RESET}`
      : `${ansiColor(8)}  오른쪽 코드를 입력하면 바로 이동합니다 (GO 없이 코드만 입력).${ANSI_RESET}`;

    // help와 동일한 예산: 세로 스크롤바 방지를 위해 총 23줄, 안내줄 1줄을 뺀 만큼이 본문.
    const linesPerPage = 19 - 1;
    const totalPages = Math.max(1, Math.ceil(rows.length / linesPerPage));
    const finalPage = Math.max(1, Math.min(requestedPage, totalPages));
    const pageSlice = rows.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);

    const parts = [
      buildTopHeader({ leftLabel: 'MENU', centerLabel: '전체 메뉴 안내 (INDEX)' }, buildPageLabel(finalPage, totalPages), targetCols),
      guideLine,
      ...pageSlice
    ];

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 23) {
      joinedLines.push('');
    }

    return {
      text: joinedLines.slice(0, 23).join('\n'),
      page: finalPage,
      totalPages
    };
  }

  async function showMenuIndex(pageOrFromHistory = 1, maybeFromHistory = false) {
    // showX(page, fromHistory) / showX(true) 두 호출 형태를 모두 받는다(라우터·명령 라우터 양쪽).
    const fromHistory = pageOrFromHistory === true || maybeFromHistory === true;
    const requestedPage = pageOrFromHistory === true ? 1 : pageOrFromHistory;

    state.screen = 'menu-index';

    // [LOG_ID: 20260718_1400] /index 로 URL 직접 진입하면 TOP을 거치지 않아 state.menuTree가
    // 아직 없다 — 그 경우 안내줄만 뜨고 메뉴 목록이 통째로 비어 나왔다(브라우저 실측). 트리는
    // loadMenuTree()가 state.menuTree에 채우고 캐시하므로, 없을 때만 먼저 부른다.
    if (!state.menuTree && typeof loadMenuTree === 'function') {
      await loadMenuTree();
    }

    const view = buildMenuIndexAnsi(requestedPage);
    state.page = view.page;
    state.menuIndexTotalPages = view.totalPages;
    if (!fromHistory) updateURL();

    await renderAnsiScreenWithTopbarSequential({
      ansiText: view.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('menuIndex'));
      }
    });
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return { showMenuIndex };
}
