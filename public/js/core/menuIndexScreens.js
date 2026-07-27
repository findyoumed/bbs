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
    getMenuNodeKey,
    isWideChar,
    loadMenuTree,
    renderScreenSequential,
    renderMenuHotspots,
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
    fitCellEllipsis
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
      // [LOG_ID: 20260727_0220] fitCell 단독 사용은 잘렸을 때 표시가 없어 "전체 메뉴 안내"가
      // "전체 메뉴 안"처럼 다른 단어로 보였다(모바일 실측: index 화면 하위 항목 다수) —
      // fitCellEllipsis로 교체해 잘린 자리에 "…"를 남긴다. 안쪽을 width-1로 제한한 뒤 바깥을
      // width로 한 번 더 패딩해, 라벨이 폭을 꽉 채울 때도 코드 칸과 붙지 않게 최소 1칸을 보장한다.
      const label = fitCell(fitCellEllipsis(toLabelText(node), width - 1), width);
      const code = fitCell(toGoCode(node), codeWidth);
      const nameColor = depth === 0 ? ansiColor(15) : ansiColor(7);
      return `${indent}${ansiColor(11)}${fitCell(door, 3, 'right')}${ANSI_RESET} ${nameColor}${label}${ANSI_RESET}${ansiColor(14)}${code}${ANSI_RESET}`;
    };

    const rows = [];
    const allNodes = [];
    getMenuChildren(state.menuTree).forEach((top) => {
      rows.push(buildRow(top, 0));
      allNodes.push(top);
      getMenuChildren(top).forEach((child) => {
        rows.push(buildRow(child, 1));
        allNodes.push(child);
      });
    });

    // [LOG_ID: 20260717_1953] 가이드라인 문구 제거 요청 반영 및 본문 줄 수를 19줄로 확대
    // [LOG_ID: 20260725_0830] 사용자 지적(전수조사) — 19줄(+상단바 4줄=23줄 총예산)은 주소창이
    // 보이는 등 뷰포트가 좁은 실사용 환경(Playwright 실측: 568px 높이에서도 여전히 잘림)에서
    // 마지막 줄이 잘렸다. 여유를 두고 15줄(총예산 19줄)로 낮춘다.
    const linesPerPage = 15;
    const totalPages = Math.max(1, Math.ceil(rows.length / linesPerPage));
    const finalPage = Math.max(1, Math.min(requestedPage, totalPages));
    const pageSlice = rows.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);
    const pageSliceNodes = allNodes.slice((finalPage - 1) * linesPerPage, finalPage * linesPerPage);

    const parts = [
      buildTopHeader({ leftLabel: 'MENU', centerLabel: '전체 메뉴 안내 (INDEX)' }, buildPageLabel(finalPage, totalPages), targetCols),
      ...pageSlice
    ];

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 19) {
      joinedLines.push('');
    }

    return {
      text: joinedLines.slice(0, 19).join('\n'),
      page: finalPage,
      totalPages,
      pageSliceNodes
    };
  }

  async function showMenuIndex(pageOrFromHistory = 1, maybeFromHistory = false) {
    // showX(page, fromHistory) / showX(true) 두 호출 형태를 모두 받는다(라우터·명령 라우터 양쪽).
    const fromHistory = pageOrFromHistory === true || maybeFromHistory === true;
    const requestedPage = pageOrFromHistory === true ? 1 : pageOrFromHistory;

    // [LOG_ID: 20260722_2200] F/B로 페이지만 넘기는 것도 매번 새 브라우저 히스토리 항목을
    // pushState하고 있었다 — 그래서 페이지를 넘긴 뒤 P(상위, HISTORY_BACK_SCREENS 폴백인
    // handleHistoryBack()이 window.history.back() 사용)를 누르면 실제 상위 화면이 아니라
    // 방금 넘긴 페이지로만 되돌아가 "P가 B처럼 작동"하는 것으로 보였다(사용자 보고: "메뉴
    // 안내에서 p를 누르면 b로 작동하네"). 이미 menu-index에 있었다면(=페이지 넘김) 히스토리를
    // 늘리지 않고 replaceState, 다른 화면에서 처음 들어온 경우에만 pushState한다.
    const stayingOnSameScreen = state.screen === 'menu-index';
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
    if (!fromHistory) updateURL(stayingOnSameScreen);

    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: view.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('txt/cmd_menu_footer.txt', getCommandFooterText('menuIndex'));
      }
    });

    // [LOG_ID: 20260717_1939] menu-index 화면 마우스 호버 및 클릭 핫스팟 바인딩 적용
    if (screenEl && Array.isArray(view.pageSliceNodes)) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const targetCols = isMobile ? 44 : 80;

      // [LOG_ID: 20260720_2130] renderAnsiScreenWithTopbarSequential이 ansiText 앞 4줄(헤더)을
      // stripLeadingAnsiLines로 잘라내 별도 상단바 DOM(.retro-topbar, .ansi-line 아님)으로 대체하므로,
      // .ansi-screen-body 안의 .ansi-line은 헤더 없이 본문 0번째 줄부터 시작한다. 여기서 헤더 줄 수를
      // 다시 더해 행 번호를 계산했더니 모든 핫스팟이 4줄씩 아래로 밀려 그려졌다 — 예를 들어 페이지의
      // 13번째 줄(0-based) 항목의 버튼이 17번째 줄(오델로) 위에 덮여, 오델로를 눌러도 13번째 줄 항목
      // (토정비결)으로 이동하는 버그가 있었다(사용자 보고: "/index?page=2 오델로 클릭 -> 토정비결").
      const hotspots = view.pageSliceNodes.map((node, i) => {
        const rowIndex = i;
        const goVal = toGoCode(node);

        return {
          row: rowIndex,
          startCol: 0,
          endCol: targetCols,
          // 코드가 존재하면 코드로 직접 이동(예: NOTICE), 없으면 단축 door 번호(예: 1)로 이동하게 설정합니다.
          // (숫자 단독 입력은 겹침 예외 처리되어 있으므로 코드가 있는 노드들만 실질적 바로가기로 연동됩니다.)
          inputValue: goVal || node.door || '',
          nodeKey: typeof getMenuNodeKey === 'function' ? getMenuNodeKey(node) : (node.go || node.id || ''),
          boardId: node.type === 'board' ? (node.go || node.id || '') : '',
          menuPath: node.type === 'menu' ? (node.go || node.id || '') : '',
          label: toLabelText(node)
        };
      });

      if (typeof renderMenuHotspots === 'function') {
        renderMenuHotspots(rendered.screenNode, hotspots);
      }
    }

    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return { showMenuIndex };
}
