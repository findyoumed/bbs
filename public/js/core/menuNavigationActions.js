import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createMenuNavigationActions(deps) {
  const {
    cmdInput,
    getBoardKey,
    getBoardMenuPath,
    getMenuChildren,
    getMenuNodeByKey,
    getMenuNodeKey,
    getMenuNodeTitle,
    getMenuParentNode,
    getBoardSelectTitle,
    normalizeSearchKey,
    refs,
    resolveAnyMenuNodeTarget,
    resolveBoardTarget,
    resolveMenuNodeTarget,
    setHint,
    setPrompt,
    showBoardSelect,
    showMain,
    startOAuthLogin,
    state
  } = deps;

  async function executeGoCommand(rawCmd) {
    const match = String(rawCmd || '').trim().match(/^GO\s+(.+)$/i);
    if (!match) return false;

    const target = match[1].trim();
    const normalized = normalizeSearchKey(target);
    if (normalized === 'TOP') {
      await showMain();
      return true;
    }

    // [LOG_ID: 20260713_1165] 나우누리 가이드(GUIDE) 메뉴 직통 분기
    if (normalized === 'GUIDE') {
      await showBoardSelect('guide', '서비스 안내');
      return true;
    }

    // [LOG_ID: 20260714_1900] 나우누리 전자우편 GO 단축 — 원전(NOW_MENU.DAT)에서
    // "11.전자우편(MAIL) -1.편지읽기(RMAIL) -2.편지쓰기(WMAIL) -3.배달확인/취소(CMAIL)"로
    // GO 이동이 가능했다. 명령어(ME/MEMO/RMAIL/CMAIL/WMAIL)로는 이미 직접 입력 가능했지만
    // GO 접두 형태는 메뉴/게시판만 매칭하고 CMD_META로 안 넘어가 빠져 있었다(사용자 지적).
    if (normalized === 'MAIL' || normalized === 'RMAIL' || normalized === 'CMAIL') {
      if (typeof refs.showMemoList === 'function') {
        state._memoBox = 'inbox';
        await refs.showMemoList();
        return true;
      }
    }
    if (normalized === 'WMAIL') {
      if (typeof refs.showMemoWrite === 'function') {
        await refs.showMemoWrite();
        return true;
      }
    }

    const currentMenuNode = state.screen === 'main'
      ? state.menuTree
      : getMenuNodeByKey(state.boardMenuPath);
    const localTargetNode = resolveMenuNodeTarget(target, getMenuChildren(currentMenuNode));
    const targetNode = localTargetNode || resolveAnyMenuNodeTarget(target);
    if (targetNode) {
      const contextNode = localTargetNode ? currentMenuNode : getMenuParentNode(targetNode);
      await executeMenuNodeAction(
        targetNode,
        getMenuNodeKey(contextNode) || 'top',
        getMenuNodeTitle(contextNode || state.menuTree)
      );
      return true;
    }

    const contextBoards = state.screen === 'board-select' ? state.boardMenuEntries : state.boards;
    const targetBoard = resolveBoardTarget(target, contextBoards) || resolveBoardTarget(target, state.boards);
    if (!targetBoard || typeof refs.showPostList !== 'function') {
      return false;
    }

    const menuPathForBoard = state.screen === 'board-select'
      ? state.boardMenuPath
      : getBoardMenuPath(targetBoard);
    const menuTitleForBoard = state.screen === 'board-select'
      ? state.boardMenuTitle
      : getBoardSelectTitle(menuPathForBoard);
    await refs.showPostList(getBoardKey(targetBoard), 1, {
      menuPath: menuPathForBoard,
      menuTitle: menuTitleForBoard
    });
    return true;
  }

  async function executeMenuNodeAction(node, menuPath = '', menuTitle = '') {
    if (!node) return false;

    const nodeKey = getMenuNodeKey(node);
    const parentNode = getMenuParentNode(node);
    const contextMenuPath = String(menuPath || getMenuNodeKey(parentNode) || 'top').trim() || 'top';
    const contextMenuTitle = String(menuTitle || getMenuNodeTitle(parentNode || state.menuTree)).trim() || getBoardSelectTitle('top');
    const targetId = String(node?.go || node?.id || '').trim();

    if (node.type === 'menu') {
      if (nodeKey === 'pds' && typeof refs.showPostList === 'function') {
        await refs.showPostList('pds', 1, {
          menuPath: contextMenuPath,
          menuTitle: '자료실'
        });
        return true;
      }
      await showBoardSelect(nodeKey, getMenuNodeTitle(node));
      return true;
    }
    if (node.type === 'board' && targetId && typeof refs.showPostList === 'function') {
      // [LOG_ID: 20260714_1300] menuTitle을 상위 메뉴 제목(contextMenuTitle)이 아니라
      // 게시판 자신의 제목으로 — 예전엔 GUIDE 하위 공지사항/건의하기를 메뉴 클릭으로
      // 들어가면 상단바가 "서비스안내 (GUIDE)"로 표시됐다(직접 URL 접속 시엔 게시판
      // 메타에서 자체 재계산되어 정상 표시라 발견이 늦었음). menuPath(상위 이동용
      // 문맥)는 그대로 유지.
      await refs.showPostList(targetId, 1, {
        menuPath: contextMenuPath,
        menuTitle: getMenuNodeTitle(node)
      });
      return true;
    }
    if (node.type === 'news' && typeof refs.showNewsMenu === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showNewsMenu();
      return true;
    }
    if (node.type === 'weather' && typeof refs.showWeatherMenu === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showWeatherMenu();
      return true;
    }
    // [LOG: 20260623_0013] vote/ranking 메뉴 타입 진입 (origin/main 포팅)
    if (node.type === 'vote' && typeof refs.showVoteList === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showVoteList();
      return true;
    }
    if (node.type === 'ranking' && typeof refs.showRanking === 'function') {
      state.boardMenuPath = contextMenuPath;
      state.boardMenuTitle = contextMenuTitle;
      await refs.showRanking();
      return true;
    }
    // [LOG_ID: 20260623_1300] Restore GAME utilities from origin/main.
    if (node.type === 'biorhythm' && typeof refs.showBiorhythm === 'function') { await refs.showBiorhythm(); return true; }
    if (node.type === 'fortune' && typeof refs.showFortune === 'function') { await refs.showFortune(); return true; }
    if (node.type === 'mbti' && typeof refs.showMbti === 'function') { await refs.showMbti(); return true; }
    // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
    if (node.type === 'retro-art' && typeof refs.showRetroArt === 'function') { await refs.showRetroArt(); return true; }
    if (node.type === 'chatt' && typeof refs.showChatLobby === 'function') {
      await refs.showChatLobby();
      return true;
    }
    // [LOG_ID: 20260713_1700] 쪽지함(전자우편) 메인 메뉴 진입점
    if (node.type === 'memo' && typeof refs.showMemoList === 'function') {
      await refs.showMemoList();
      return true;
    }
    if (node.type === 'login' && typeof refs.showLogin === 'function') {
      refs.showLogin();
      return true;
    }
    if (node.type === 'password-reset' && typeof refs.showPasswordReset === 'function') {
      refs.showPasswordReset();
      return true;
    }
    if (node.type === 'oauth-login') {
      const provider = String(node?.go || '').trim().toLowerCase();
      try {
        setHint(`${getMenuNodeTitle(node)} 인증 페이지로 이동합니다.`);
        setPrompt('>>');
        await startOAuthLogin(provider);
      } catch (error) {
        setHint(error.message || '소셜 로그인을 시작할 수 없습니다.');
        setPrompt('>>');
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
      }
      return true;
    }
    if (node.type === 'signup' && typeof refs.showSignup === 'function') {
      await refs.showSignup();
      return true;
    }
    if (node.type === 'myinfo' && typeof refs.showMyInfo === 'function') {
      refs.showMyInfo();
      return true;
    }
    // [LOG_ID: 20260713_2030] 나우누리 GUIDE 화면의 "31.명령어" 바로가기 — 기존 H/HELP
    // 전역 명령과 동일 화면(refs.showHelp) 재사용.
    if (node.type === 'help' && typeof refs.showHelp === 'function') {
      await refs.showHelp();
      return true;
    }
    // [LOG_ID: 20260713_2100] GUIDE 화면 "12.이용약관" 등 정적 문서 뷰어 — target 속성으로
    // tos/privacy 중 어느 문서를 열지 지정한다(기본값 tos).
    if (node.type === 'policy' && typeof refs.showPolicy === 'function') {
      await refs.showPolicy(String(node.target || 'tos').trim());
      return true;
    }
    return false;
  }

  return {
    executeGoCommand,
    executeMenuNodeAction
  };
}
