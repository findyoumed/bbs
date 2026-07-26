import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createPostListView(deps) {
  const {
    ansiToHTML,
    apiFetch,
    applyCommandFooter,
    buildPostListAnsi,
    cmdInput,
    getBoardKey,
    getBoardSelectTitle,
    getCommandFooterText,
    getSupportedFooterText,
    loadMenuTree,
    loadPosts,
    screenEl,
    setLoading,
    setReady,
    setPrompt,
    setHint,
    state,
    updateURL,
    findBoardByKey,
    renderScreenSequential
  } = deps;

  const {
    ANSI_RESET,
    ansiColor,
    buildThreadPrefix,
    buildTopHeader,
    ansiHLine,
    fitCell,
    fitCountCell,
    formatShortDate,
    wrapAnsiText,
    displayWidth
  } = createAnsiBuilderUtils(deps);

  // [LOG: 20260721_1656] transform: scale 반응형 뷰포트 확대 대응 좌표 오차 수정
  function renderPostHotspots(screenNode, posts) {
    if (!screenNode || !posts.length) return;
    const layer = document.createElement('div');
    layer.className = 'ansi-hotspot-layer';
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    // [LOG_ID: 20260712_2110] 종전에는 "본문 줄 0부터가 게시물"이라는 인덱스 가정(rowIdx = index)으로
    // 핫스팟을 붙였는데, 실제 본문은 카운트라인·컬럼 헤더·구분선 3줄이 먼저 온다 — 핫스팟 전체가
    // 3줄 위로 어긋나 헤더 영역이 클릭되고(사용자 보고) 정작 마지막 게시물 3건은 클릭 불가였다.
    // 인덱스 가정 대신 각 게시물 번호(postLine의 첫 토큰)로 실제 줄을 찾아 붙인다 — 헤더 줄 수가
    // 바뀌어도 어긋나지 않는다.
    const screenRect = screenNode.getBoundingClientRect();
    const scale = screenRect.width / (screenNode.offsetWidth || 1);
    let searchFrom = 0;
    posts.forEach((post) => {
      const idToken = String((post.localId ?? post.id) || '').trim();
      if (!idToken) return;
      let lineNode = null;
      for (let i = searchFrom; i < lineNodes.length; i++) {
        const firstToken = (lineNodes[i].textContent || '').trim().split(/\s+/)[0];
        if (firstToken === idToken) {
          lineNode = lineNodes[i];
          searchFrom = i + 1;
          break;
        }
      }
      if (!lineNode) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ansi-hotspot post-hotspot';
      btn.dataset.postid = String(post.localId ?? post.id); btn.setAttribute('aria-label', post.title || '');
      const rect = lineNode.getBoundingClientRect();
      const topVal = (rect.top - screenRect.top) / scale;
      const heightVal = (rect.height || 16) / scale;
      btn.style.left = '0'; btn.style.top = `${topVal}px`;
      btn.style.width = '100%'; btn.style.height = `${heightVal}px`;
      layer.appendChild(btn);
    });
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  async function showPostList(boardId, page = 1, options = {}, fromHistory = false) {
    state.screen = 'post-list';
    const boardKey = String(boardId || '').trim();
    const hasExplicitMenuPath = options.menuPath !== undefined;
    const hasExplicitMenuTitle = options.menuTitle !== undefined;
    const contextPath = hasExplicitMenuPath ? options.menuPath : (state.boardMenuPath || 'top');
    state.boardMenuPath = contextPath;
    state.boardMenuTitle = hasExplicitMenuTitle ? options.menuTitle : getBoardSelectTitle(contextPath);
    state.board = findBoardByKey(boardKey) || { id: boardKey, boardId: boardKey, name: boardKey };
    state.page = page;
    const searchParams = options.searchParams || state.searchParams || {};
    state.searchParams = searchParams;
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    const data = await loadPosts(boardKey, page, searchParams);

    if (data.board) {
      const resolvedKey = String(getBoardKey(data.board) || boardKey).trim();
      state.board = { ...state.board, ...data.board, id: resolvedKey, boardId: resolvedKey };
      if (!hasExplicitMenuPath) {
        const resolvedMenuPath = String(data.board.menuPath || state.boardMenuPath || 'top').trim() || 'top';
        // [LOG: 20260421_1645] 직접 /board/... 진입 시 보드 메타 기준으로 상위 메뉴 문맥을 복원한다.
        if (typeof loadMenuTree === 'function') {
          await loadMenuTree();
        }
        state.boardMenuPath = resolvedMenuPath;
        state.boardMenuTitle = hasExplicitMenuTitle ? options.menuTitle : getBoardSelectTitle(resolvedMenuPath);
      }
    }
    let displayTitle = state.boardMenuTitle;
    if (searchParams.lt) displayTitle += ` [제목검색: ${searchParams.lt}]`;
    if (searchParams.li) displayTitle += ` [작성자검색: ${searchParams.li}]`;
    if (searchParams.lc) displayTitle += ` [내용검색: ${searchParams.lc}]`;
    if (searchParams.recent) displayTitle += ` [새글만보기: ${searchParams.recent}일]`;
    // [LOG_ID: 20260713_1020] 상단바에 주제어검색 텍스트 추가
    if (searchParams.k) displayTitle += ` [주제어검색: ${searchParams.k}]`;

    // [LOG_ID: 20260708_1300] setReady(true)를 남은 await(loadMenuTree)가 모두 끝난 뒤,
    // 렌더 호출 바로 직전으로 옮긴다. 예전 위치(로딩 타이머 취소 목적)는 그 뒤에 여전히
    // await가 남아 있어, 그 사이 footer가 먼저 드러나며 구분선/힌트가 본문 없이(또는 이전 화면의
    // 낡은 내용인 채) 노출되는 순서 역행을 만들었다.
    setReady(true);

    // [LOG_ID: 20260717_1900] 회원 신분 배너("## OOO님은 손님입니다 ##")를 제거했다.
    //
    // 출처는 docs/hitel_upgrade_plan.txt P1-3("동호회식 신분 배너", 길라잡이 p.152 인용)이었으나,
    // 사용자 지적("하이텔 나우누리 원본에 이런건 없는데")대로 우리 게시판/자료실에 붙일 근거가
    // 약하다 — 원전의 그 배너는 동호회(FORUM)/자료실에서 "그 모임에서의 내 신분"을 알려주는
    // 것이지, 일반 게시판 목록마다 뜨는 줄이 아니다.
    //
    // 게다가 구현 결과가 게스트에게 `## 손님(guest)님은 손님입니다 ##` 라는 말이 안 되는
    // 문장을 냈다 — 게스트는 닉네임도 '손님'이고 신분 라벨도 '손님'이라 같은 말이 두 번
    // 나온다. (20260715_1400에 게스트 판정 버그를 고쳤지만, 고치고 나니 이 중복이 드러났다.)
    //
    // 동호회 기능이 실제로 생기면 그때 그 화면에서 되살린다. state._memberBannerShown 플래그도
    // 더 이상 쓰지 않는다.

    // [LOG: 20260426_1450] Evolve Mode: Sequential rendering for post list
    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const footerAssetPath = String(state.board?.footerFile || '').trim();
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildPostListAnsi(state.board, state.posts, state.page, state.totalPages, state.totalCount, displayTitle, searchParams),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(
          footerAssetPath,
          getSupportedFooterText(state) || getCommandFooterText('postList'),
          footerAssetPath ? 'txt/cmd_board_footer.txt' : ''
        );
      }
    });

    renderPostHotspots(rendered.screenNode, state.posts);
    // [LOG: 20260424_2020] 모바일에서 게시판 목록 진입 시 키보드 자동 팝업 방지
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  // [LOG_ID: 20260712_2200] PT 100건 제목 출력 대기 화면
  async function showPtPrepare(startNum) {
    state.screen = 'pt-prepare';
    state._ptStartNum = startNum;
    // [LOG_ID: 20260727_0500] 새 PT 실행마다 이전 결과 캐시를 지워, 다음 showPtResult 페이지
    // 이동이 옛 startNum 기준 결과를 그대로 재사용하지 않게 한다.
    state._ptFilteredPosts = null;
    state._ptFetchError = null;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = state.board?.name || state.board?.boardId || '게시판';
    const boardCode = state.board?.id || '';
    const header = buildTopHeader({ leftLabel: boardCode, centerLabel: boardName }, '', targetCols);

    const bodyLines = [
      '',
      ' PRINTER/CAPTURE 를 준비하시고 Enter를 누르십시오',
      ''
    ];

    const ansiText = header + '\n' + bodyLines.join('\n') + '\n' + '─'.repeat(targetCols);

    renderAnsiScreenWithTopbar({
      ansiText,
      ansiToHTML,
      screenEl
    });

    setPrompt('Enter키를 누르십시오 >>');
    setHint('PT: 프린터/갈무리 대기 상태');
    setReady(true);
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  // [LOG_ID: 20260712_2200] PT 100건 제목 일괄 출력 구현
  // [LOG_ID: 20260727_0500] 이름 그대로 최대 100건을 한 화면에 다 그렸는데, ansiEngine.js의
  // 25행 고정 격자(putChar가 row>=25면 HTML로 렌더되기도 전에 문자를 그냥 버림)라 20건만
  // 넘어도 나머지가 조용히 사라졌다 — 이 세션에서 찾은 것 중 "기능의 원래 목적(100건 출력)이
  // 애초에 그 화면의 물리적 한계(25행)를 넘는" 가장 직접적인 형태의 버그. 단순 절삭+안내로는
  // "100건 일괄 출력"이라는 기능 목적 자체가 무의미해지므로, 게시글 보기/설문 선택지처럼
  // 페이지네이션을 적용한다. 재조회를 피하려고 첫 조회 결과를 state._ptFilteredPosts에 캐시.
  const PT_LINES_PER_PAGE = 16;

  async function showPtResult(requestedPageNo = 1) {
    state.screen = 'pt-view';

    let filtered;
    let fetchError = state._ptFetchError || null;
    if (requestedPageNo > 1 && Array.isArray(state._ptFilteredPosts)) {
      filtered = state._ptFilteredPosts;
    } else {
      setLoading('출력하는 중입니다..');

      const boardKey = String(state.board?.id || '').trim();
      const url = `/api/boards/${encodeURIComponent(boardKey)}?page=1&pageSize=100`;
      // [LOG_ID: 20260721_2040] 실패를 null로 삼켜 "지정 번호 이후의 글이 없습니다"와 구분이 안 됐다
      // (사용자에겐 둘 다 빈 화면으로 보임) — 실패 사유를 별도로 표시한다.
      fetchError = null;
      const responseData = await apiFetch(url).catch((error) => { fetchError = error; return null; });

      setReady(true);

      const posts = Array.isArray(responseData?.items) ? responseData.items : (responseData?.posts || []);
      filtered = posts
        .filter(post => Number(post.localId ?? post.id) >= (state._ptStartNum || 1))
        .slice(0, 100);
      state._ptFilteredPosts = filtered;
      state._ptFetchError = fetchError;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = state.board?.name || state.board?.boardId || '게시판';
    const boardCode = state.board?.id || '';
    const header = buildTopHeader({ leftLabel: boardCode, centerLabel: boardName }, '', targetCols);

    function columnHeader() {
      if (isMobile) {
        return ansiColor(14) + ' 번호   ID     날짜  제  목' + ANSI_RESET;
      }
      return ansiColor(14) + ' 번호   이름       ID      날짜  조회 Pg    제  목' + ANSI_RESET;
    }

    function postLine(post) {
      if (isMobile) {
        const titlePrefix = buildThreadPrefix(post.step);
        const rawTitle = titlePrefix + String(post.title || '');
        const title = fitCell(rawTitle, 22);

        const userId = fitCell(post.userId || post.authorUserId || '', 8);
        const date = fitCell(formatShortDate(post.createdAt).slice(0, 5), 5);
        const postId = fitCell(String((post.localId ?? post.id) || ''), 6, 'right');

        return ansiColor(15) + postId + ' ' +
          ansiColor(11) + userId + ' ' +
          ansiColor(8) + date + ' ' +
          ansiColor(15) + title +
          ANSI_RESET;
      }

      const titlePrefix = buildThreadPrefix(post.step);
      const rawTitle = titlePrefix + String(post.title || '');
      const title = fitCell(rawTitle, 36);

      const author = fitCell(post.nickName || post.authorNickName || '', 8);
      const userId = fitCell(post.userId || post.authorUserId || '', 8);
      const date = fitCell(formatShortDate(post.createdAt), 5);
      // [LOG_ID: 20260727_0715] 조회수가 칸 폭(4)을 넘으면 fitCell이 뒷자리를 그냥 잘라 실제보다
      // 작은 값으로 보였다(게시판 목록과 같은 버그 클래스). fitCountCell로 교체.
      const hits = fitCountCell(post.hit || post.views || 0, 4);

      const sample = String(post.content || post.body || post.title || '').trim();
      const wrapLines = wrapAnsiText(sample, 60);
      const pageCount = Math.max(1, Math.ceil(wrapLines.length / 16));
      const pages = fitCell(String(pageCount), 2, 'right');

      const postId = fitCell(String((post.localId ?? post.id) || ''), 6, 'right');

      return ansiColor(15) + postId + ' ' +
        ansiColor(15) + author + ' ' +
        ansiColor(11) + userId + ' ' +
        ansiColor(8) + date + ' ' +
        ansiColor(8) + hits + ' ' +
        ansiColor(8) + pages + '  ' +
        ansiColor(15) + title +
        ANSI_RESET;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PT_LINES_PER_PAGE));
    const pageNo = Math.min(Math.max(1, requestedPageNo), totalPages);
    const pageSlice = filtered.slice((pageNo - 1) * PT_LINES_PER_PAGE, pageNo * PT_LINES_PER_PAGE);

    const lines = [
      header,
      columnHeader(),
      ansiHLine(targetCols, 8)
    ];

    if (fetchError) {
      lines.push(ansiColor(9) + ` 목록을 불러오지 못했습니다: ${fetchError.message || '알 수 없는 오류'}` + ANSI_RESET);
    } else if (!filtered.length) {
      lines.push(ansiColor(8) + ' 지정 번호 이후의 글이 없습니다.' + ANSI_RESET);
    } else {
      pageSlice.forEach(post => {
        lines.push(postLine(post));
      });
    }

    lines.push(ansiHLine(targetCols, 8));
    if (pageNo < totalPages) {
      lines.push(ansiColor(15) + ` F:다음 페이지, 다른 키:목록으로 돌아갑니다 (${pageNo}/${totalPages})` + ANSI_RESET);
    } else {
      lines.push(ansiColor(15) + ' 아무 키나 누르시면 목록으로 돌아갑니다...' + (totalPages > 1 ? ` (${pageNo}/${totalPages})` : '') + ANSI_RESET);
    }

    state._ptPageNo = pageNo;
    state._ptPageCount = totalPages;

    renderAnsiScreenWithTopbar({
      ansiText: lines.join('\n'),
      ansiToHTML,
      screenEl
    });

    setPrompt(pageNo < totalPages ? 'F=다음 페이지, 기타키=목록 >>' : '아무 키나 누르십시오 >>');
    setHint(pageNo < totalPages ? `PT: 출력 완료 (${pageNo}/${totalPages}, F로 다음 페이지)` : 'PT: 출력 완료 (목록 복귀 대기)');
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showPostList, showPtPrepare, showPtResult };
}
