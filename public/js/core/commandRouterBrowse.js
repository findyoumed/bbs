import { UI_TEXT } from './i18n.js';

/**
 * commandRouterBrowse.js
 * [LOG: 20260426_2120] Evolution Mode: Integrated i18n and replaced unicode escapes.
 */

export function createBrowseCommandHandler(deps) {
  const {
    apiFetch,
    deletePost,
    doLogout,
    executeMenuNodeAction,
    getMenuChildren,
    getMenuNodeByKey,
    getBoardSelectTitle,
    getMenuNodeKey,
    getMenuNodeTitle,
    getMenuParentKey,
    resolveMenuNodeTarget,
    setHint,
    setPrompt,
    showBoardSelect,
    showLogin,
    showMain,
    showPostList,
    showPostView,
    showPostWrite,
    showToast,
    showAlert,
    state,
    showPtPrepare,
    showPtResult
  } = deps;

  function resolveVisiblePostTarget(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
      return null;
    }

    const posts = Array.isArray(state.posts) ? state.posts : [];
    const byPostId = posts.find((post) => String(post?.id || '').trim() === value);
    if (byPostId) {
      return byPostId;
    }

    const rowNumber = parseInt(value, 10);
    if (rowNumber >= 1 && posts[rowNumber - 1]) {
      return posts[rowNumber - 1];
    }

    return null;
  }

  function canManagePost(post) {
    if (!post || !state.user || state.user.isGuest) {
      return false;
    }
    return state.user.isAdmin || state.user.userId === (post.authorUserId || post.userId);
  }

  function beginDeleteConfirm(post) {
    state._deleteConfirmStage = {
      boardId: state.board?.id,
      postId: post.id,
      postTitle: post.title || '',
      page: state.page,
      menuPath: state.boardMenuPath,
      menuTitle: state.boardMenuTitle,
      searchParams: { ...(state.searchParams || {}) },
      returnScreen: 'post-list'
    };
    setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${post.title || post.id}`);
    setPrompt(`${UI_TEXT.POST_DELETE_CONFIRM} (Y/N) [Y]:`);
  }

  async function restoreDeleteConfirmList(deleteStage) {
    await showPostList(deleteStage.boardId, deleteStage.page, {
      menuPath: deleteStage.menuPath,
      menuTitle: deleteStage.menuTitle,
      searchParams: { ...(deleteStage.searchParams || {}) }
    });
  }

  return async function handleBrowseCommand({ s, input, cmd, rawCmd, context }) {
    // [LOG_ID: 20260712_2200] PT 가상 화면 입출력 바인딩
    if (s === 'pt-prepare') {
      if (typeof showPtResult === 'function') {
        await showPtResult();
      }
      return true;
    }
    if (s === 'pt-view') {
      await showPostList(state.board.id, state.page, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: state.searchParams
      });
      return true;
    }

    if (s === 'main') {
      // [LOG_ID: 20260713_1155] 나우누리 테마 시 전용 번호 매핑 분기
      if (state.theme === 'nownuri') {
        const num = String(rawCmd || '').trim();
        if (num === '1') {
          if (typeof showBoardSelect === 'function') {
            await showBoardSelect('guide', '서비스 안내');
          }
          return true;
        }
        if (num === '11') {
          if (state.user?.isGuest) {
            setHint('편지함은 로그인 후 사용하실 수 있습니다.');
            setDefaultPrompt();
          } else if (typeof showMemoList === 'function') {
            state._memoBox = 'inbox';
            await showMemoList();
          }
          return true;
        }
        if (num === '12') {
          if (typeof showBoardSelect === 'function') {
            await showBoardSelect('top', '게시판 목록');
          }
          return true;
        }
        if (num === '13') {
          if (typeof showChatLobby === 'function') {
            await showChatLobby();
          }
          return true;
        }
        if (num === '16') {
          if (typeof showPostList === 'function') {
            await showPostList('pds', 1, { menuPath: 'top', menuTitle: '자료실' });
          }
          return true;
        }
        if (/^\d+$/.test(num)) {
          setHint('준비 중인 서비스입니다.');
          setDefaultPrompt();
          return true;
        }
      }

      const visibleEntries = Array.isArray(state.boardMenuEntries) && state.boardMenuEntries.length
        ? state.boardMenuEntries
        : getMenuChildren(getMenuNodeByKey('top') || state.menuTree);
      const node = resolveMenuNodeTarget(rawCmd, visibleEntries);
      if (await executeMenuNodeAction(node, state.boardMenuPath, state.boardMenuTitle)) { return true; }
      if (cmd === 'LOGIN' && state.user?.isGuest) { showLogin(); return true; }
      if (cmd === 'P' || cmd === 'M' || cmd === 'B' || cmd === 'T') { await showMain(); return true; }
      if (cmd === 'Q' && !state.user?.isGuest) { await doLogout(); await showMain(); return true; }
      // [LOG: 20260509_1138] Let unhandled main-screen input fall through so global commands like H/C/PERF still run.
      return false;
    }

    if (s === 'board-select') {
      // [LOG_ID: 20260713_1165] 나우누리 가이드 서브메뉴 번호 가로채기
      if (state.theme === 'nownuri' && state.boardMenuPath === 'guide') {
        const num = String(rawCmd || '').trim();
        if (num === '14') {
          if (typeof showAlert === 'function') {
            await showAlert(
              `나우누리 접속방법 및 전화번호 안내\n\n` +
              `1. 모뎀 접속 번호 (전국망) : 01411 (NowRo 등 에뮬레이터 이용 시)\n` +
              `2. 대표 안내 및 고객센터 : (02) 590-3800, (080) 990-3800\n` +
              `3. 시스템 사양 : 286 PC 이상, HGC/CGA/EGA/VGA 모니터 지원\n` +
              `4. 전용 통신 프로그램 : 나우로 (NowRo) v0.9b 권장\n\n` +
              `[아무 키나 누르시면 가이드 메뉴로 복귀합니다]`
            );
          } else {
            setHint('나우누리 접속번호: 01411 / (02) 590-3800');
          }
          return true;
        }
        if (/^\d+$/.test(num)) {
          setHint('준비 중인 가이드 서비스입니다.');
          setPrompt('선택 >>');
          return true;
        }
      }

      if (cmd === 'B' || cmd === 'P' || cmd === 'M') {
        const parentKey = getMenuParentKey(state.boardMenuPath);
        if (!parentKey || parentKey === 'top') {
          await showMain();
        } else {
          await showBoardSelect(parentKey, getBoardSelectTitle(parentKey));
        }
        return true;
      }
      if (cmd === 'T') { await showMain(); return true; }

      const node = resolveMenuNodeTarget(rawCmd, state.boardMenuEntries);
      if (await executeMenuNodeAction(node, state.boardMenuPath, state.boardMenuTitle)) { return true; }
      // [LOG: 20260509_1138] Let unhandled menu input fall through to global command handlers.
      return false;
    }

    if (s === 'post-list') {
      if (state._deleteConfirmStage) {
        const deleteStage = state._deleteConfirmStage;
        const textInput = String(input || '').trim();
        const normalizedInput = String(rawCmd || '').trim().toUpperCase();

        if (!textInput || normalizedInput === 'Y' || normalizedInput === 'YES') {
          state._deleteConfirmStage = null;
          if (typeof deletePost !== 'function') {
            setHint(`${UI_TEXT.ERROR}: deletePost handler is not available.`);
            setPrompt('>>');
            return true;
          }
          try {
            await deletePost(deleteStage.boardId, deleteStage.postId);
            await restoreDeleteConfirmList(deleteStage);
            showToast?.(UI_TEXT.POST_DELETE_SUCCESS, 2000, 'success');
          } catch (error) {
            setHint(`${UI_TEXT.ERROR}: ${error.message}`);
            setPrompt('>>');
          }
          return true;
        }

        if (normalizedInput === 'N' || normalizedInput === 'NO') {
          state._deleteConfirmStage = null;
          await restoreDeleteConfirmList(deleteStage);
          return true;
        }

        setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${deleteStage.postTitle || deleteStage.postId}`);
        setPrompt(`${UI_TEXT.POST_DELETE_CONFIRM} (Y/N) [Y]:`);
        return true;
      }

      if (cmd === 'P' || cmd === 'M') {
        if (state.boardMenuPath && state.boardMenuPath !== 'top') {
          await showBoardSelect(state.boardMenuPath, state.boardMenuTitle || getBoardSelectTitle(state.boardMenuPath));
        } else {
          await showMain();
        }
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'L') {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: {}
        });
        return true;
      }
      if (cmd === 'F' && state.page < state.totalPages) {
        await showPostList(state.board.id, state.page + 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        });
        return true;
      }
      if (cmd === 'B' && state.page > 1) {
        await showPostList(state.board.id, state.page - 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        });
        return true;
      }
      // [LOG_ID: 20260713_1120] 자료실 목록 화면에서의 DN 단독 실행 2단계 가로채기
      if (state._pendingDownloadPrompt) {
        const idx = parseInt(cmd, 10);
        state._pendingDownloadPrompt = false;
        setPrompt('선택 >>');
        if (idx >= 1 && state.posts?.[idx - 1]) {
          const post = state.posts[idx - 1];
          await startPdsDownloadSequence(post);
        } else {
          setHint('잘못된 번호입니다.');
        }
        return true;
      }

      // [LOG_ID: 20260713_1120] PDS 자료 올리기(UP) 커맨드
      if (cmd === 'UP') {
        const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
        if (isPds) {
          showPostWrite('create');
          return true;
        }
      }

      // [LOG_ID: 20260713_1120] PDS 자료 내려받기(DN [번호]) 커맨드
      const dnMatch = cmd.match(/^DN(?:\s+(\d+))?$/i);
      if (dnMatch) {
        const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
        if (!isPds) {
          return false;
        }

        const rawNum = dnMatch[1];
        if (rawNum) {
          const idx = parseInt(rawNum, 10);
          if (idx >= 1 && state.posts?.[idx - 1]) {
            const post = state.posts[idx - 1];
            await startPdsDownloadSequence(post);
          } else {
            setHint('존재하지 않는 번호입니다.');
            setPrompt('선택 >>');
          }
          return true;
        } else {
          state._pendingDownloadPrompt = true;
          setHint('다운로드할 글 번호를 입력해 주십시오.');
          setPrompt('글 번호 >>');
          return true;
        }
      }

      async function startPdsDownloadSequence(post) {
        setHint('첨부파일 정보를 확인하는 중입니다..');
        try {
          const attachments = await apiFetch(`/api/boards/${state.board.id}/posts/${post.id}/attachments`);
          if (Array.isArray(attachments) && attachments.length > 0) {
            const file = attachments[0];
            state._pendingDownload = {
              boardId: state.board.id,
              postId: post.id,
              fileId: file.id,
              fileName: file.originalFilename || file.filename,
              fileSize: file.fileSize
            };
            
            // 임시로 attachment-list 로 전환하여 postView의 공통 프로토콜 선택 모듈을 재사용
            state._originScreenForDownload = 'post-list';
            state.screen = 'attachment-list';
            state._downloadStage = 'protocol';
            setHint('* 화일 전송 프로토콜을 선택하십시오.\n1.Kermit  2.Zmodem  3.Super Kermit  0.취소');
            setPrompt('선택 (1-3, 0) >>');
          } else {
            setHint('이 게시글에는 첨부파일이 존재하지 않습니다.');
            setPrompt('선택 >>');
          }
        } catch (err) {
          setHint(`정보 조회 실패: ${err.message}`);
          setPrompt('선택 >>');
        }
      }

      if (cmd === 'W') {
        // [LOG: 20260429_0258] Route list-screen write through postWriteView's
        // shared guard so guest users get the same login-required hint as direct /board/.../write.
        showPostWrite('create');
        return true;
      }

      // [LOG_ID: 20260718_1900] 제목 검색: LT/GL/SUBJ [검색어]
      const ltMatch = cmd.match(/^(?:LT|GL|SUBJ)\s+(.+)$/i);
      if (ltMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { lt: ltMatch[1].trim() }
        });
        return true;
      }

      // [LOG_ID: 20260718_1900] 내용 검색: GA/BODY [검색어]
      const lcMatch = cmd.match(/^(?:GA|BODY)\s+(.+)$/i);
      if (lcMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { lc: lcMatch[1].trim() }
        });
        return true;
      }

      // [LOG_ID: 20260718_1900] 새 글 보기: NEW/NW (최근 3일 게시글 필터링)
      if (cmd === 'NEW' || cmd === 'NW') {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { recent: '3' }
        });
        return true;
      }

      // [LOG_ID: 20260713_1020] LS [번호] 리스트 점프 명령어 추가
      const lsMatch = cmd.match(/^LS\s+(\d+)$/i);
      if (lsMatch) {
        const targetPostId = Number(lsMatch[1]);
        setHint('번호 위치를 스캔 중입니다..');
        apiFetch(`/api/boards/${state.board.id}?page=1&pageSize=9999`)
          .then((res) => {
            const posts = Array.isArray(res) ? res : (res.posts || res.items || []);
            const idx = posts.findIndex((p) => Number(p.id) === targetPostId);
            if (idx >= 0) {
              const targetPage = Math.floor(idx / 15) + 1;
              setHint(`[목록 점프] #${targetPostId} 글이 있는 ${targetPage}페이지로 이동합니다.`);
              return showPostList(state.board.id, targetPage, {
                menuPath: state.boardMenuPath,
                menuTitle: state.boardMenuTitle
              });
            } else {
              setHint(`해당 번호(#${targetPostId})의 글이 존재하지 않습니다.`);
              setPrompt('선택 >>');
            }
          })
          .catch((err) => {
            setHint(`스캔 실패: ${err.message}`);
            setPrompt('선택 >>');
          });
        return true;
      }

      // [LOG_ID: 20260713_1020] LD [월/일] 리스트 점프 명령어 추가
      const ldMatch = cmd.match(/^LD\s+(\d{1,2})\/(\d{1,2})$/i);
      if (ldMatch) {
        const targetMonth = Number(ldMatch[1]);
        const targetDay = Number(ldMatch[2]);
        if (targetMonth < 1 || targetMonth > 12 || targetDay < 1 || targetDay > 31) {
          setHint('날짜 형식이 잘못되었습니다. (예: LD 07/13)');
          setPrompt('선택 >>');
          return true;
        }

        setHint('날짜 위치를 스캔 중입니다..');
        apiFetch(`/api/boards/${state.board.id}?page=1&pageSize=9999`)
          .then((res) => {
            const posts = Array.isArray(res) ? res : (res.posts || res.items || []);
            const currentYear = new Date().getFullYear();
            const targetDate = new Date(currentYear, targetMonth - 1, targetDay, 23, 59, 59);

            const idx = posts.findIndex((p) => {
              const postDate = new Date(p.createdAt);
              return postDate <= targetDate;
            });

            if (idx >= 0) {
              const targetPage = Math.floor(idx / 15) + 1;
              setHint(`[목록 점프] ${targetMonth}/${targetDay}와 같거나 이전인 글이 있는 ${targetPage}페이지로 이동합니다.`);
              return showPostList(state.board.id, targetPage, {
                menuPath: state.boardMenuPath,
                menuTitle: state.boardMenuTitle
              });
            } else {
              setHint(`지정하신 날짜(${targetMonth}/${targetDay}) 이전의 글이 존재하지 않습니다.`);
              setPrompt('선택 >>');
            }
          })
          .catch((err) => {
            setHint(`스캔 실패: ${err.message}`);
            setPrompt('선택 >>');
          });
        return true;
      }

      // [LOG_ID: 20260713_1020] K [주제어] 검색 명령어 추가
      const kMatch = cmd.match(/^K\s+(.+)$/i);
      if (kMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { k: kMatch[1].trim() }
        });
        return true;
      }

      // [LOG_ID: 20260713_1020] K 주제어 해제 명령어 추가
      if (cmd === 'K') {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { k: '' }
        });
        return true;
      }

      // [LOG_ID: 20260713_1020] KW 주제어(말머리) 집계 목록 명령어 추가
      if (cmd === 'KW') {
        setHint('주제어를 수집 중입니다..');
        apiFetch(`/api/boards/${state.board.id}?page=1&pageSize=9999`)
          .then((res) => {
            const posts = Array.isArray(res) ? res : (res.posts || res.items || []);
            const keywordsSet = new Set();
            posts.forEach((p) => {
              const m = String(p.title || '').match(/\[([^\]]+)\]/);
              if (m) {
                keywordsSet.add(m[1].trim());
              }
            });
            const list = [...keywordsSet].join(', ');
            setHint(list ? `[주제어 목록] ${list}` : '이 게시판에는 등록된 주제어가 없습니다.');
            setPrompt('선택 >>');
          })
          .catch((err) => {
            setHint(`수집 실패: ${err.message}`);
            setPrompt('선택 >>');
          });
        return true;
      }

      const liMatch = cmd.match(/^LI\s+(.+)$/);
      if (liMatch) {
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { li: liMatch[1].trim() }
        });
        return true;
      }

      // [LOG_ID: 20260718_1900] 검색 모드 진입 명령어 확장
      if (cmd === 'LT' || cmd === 'GL' || cmd === 'SUBJ' || cmd === 'LI' || cmd === 'GA' || cmd === 'BODY') {
        const type = (cmd === 'GL' || cmd === 'SUBJ') ? 'lt' : (cmd === 'GA' || cmd === 'BODY') ? 'lc' : cmd.toLowerCase();
        state._pendingSearch = {
          type,
          boardId: state.board.id,
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle
        };
        const hintText = (type === 'lt') ? UI_TEXT.SEARCH_TITLE_PROMPT 
                       : (type === 'lc') ? UI_TEXT.SEARCH_CONTENT_PROMPT 
                       : UI_TEXT.SEARCH_AUTHOR_PROMPT;
        const promptText = (type === 'lt') ? UI_TEXT.SEARCH_KEYWORD 
                         : (type === 'lc') ? UI_TEXT.SEARCH_KEYWORD 
                         : UI_TEXT.SEARCH_AUTHOR_ID;
        setHint(hintText);
        setPrompt(promptText);
        return true;
      }

      const editMatch = rawCmd.match(/^(?:E|ED|EDIT)\s+(.+)$/);
      if (editMatch) {
        if (state.user?.isGuest) {
          setHint(UI_TEXT.LOGIN_REQUIRED);
          setPrompt('>>');
          return true;
        }

        const targetPost = resolveVisiblePostTarget(editMatch[1]);
        if (!targetPost) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }
        if (!canManagePost(targetPost)) {
          setHint(UI_TEXT.POST_EDIT_MY_ONLY);
          setPrompt('>>');
          return true;
        }
        showPostWrite('edit', targetPost);
        return true;
      }

      const deleteMatch = rawCmd.match(/^(?:D|DD)\s+(.+)$/);
      if (deleteMatch) {
        if (state.user?.isGuest) {
          setHint(UI_TEXT.LOGIN_REQUIRED);
          setPrompt('>>');
          return true;
        }

        const targetPost = resolveVisiblePostTarget(deleteMatch[1]);
        if (!targetPost) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }
        if (!canManagePost(targetPost)) {
          setHint(UI_TEXT.POST_DELETE_MY_ONLY);
          setPrompt('>>');
          return true;
        }

        beginDeleteConfirm(targetPost);
        return true;
      }

      // [LOG_ID: 20260712_2200] PT [번호] 제목 100건 일괄 출력 연출 복원
      const ptMatch = cmd.match(/^PT(?:\s+(\d+))?$/);
      if (ptMatch) {
        const startNum = ptMatch[1] ? parseInt(ptMatch[1], 10) : 1;
        if (typeof showPtPrepare === 'function') {
          await showPtPrepare(startNum);
          return true;
        }
      }

      // [LOG_ID: 20260711_1340] PR [번호] 연속읽기 — olddos-bbs(hanulso) 원작 명령 복원.
      // 해당 글부터 열고, 이후 post-view에서 빈 엔터로 다음 글을 이어서 읽는다.
      // [LOG_ID: 20260712_2210] 하이텔 원전 스펙(길라잡이 p.136) 확장: 'PR 번호1-번호2'(범위)와
      // 'PR 번호1,번호2,...'(나열, 최대 10건)를 지원한다. 지정 집합은 큐(_continuousRead.queue)에
      // 담아 빈 엔터마다 순서대로 열고, 소진되면 연속읽기를 마친다. 현재 목록(state.posts)에 있는
      // 글만 대상이며 범위는 번호 오름차순(옛 글부터)으로 순회한다.
      const prMatch = cmd.match(/^PR(?:\s+([\d,\s-]+))?$/);
      if (prMatch) {
        const spec = String(prMatch[1] || '').trim();
        let targets = [];

        const rangeMatch = spec.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          const low = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          const high = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          targets = state.posts
            .filter((post) => { const id = parseInt(post.id, 10); return id >= low && id <= high; })
            .sort((left, right) => parseInt(left.id, 10) - parseInt(right.id, 10))
            .slice(0, 10);
        } else if (spec.includes(',')) {
          const ids = spec.split(',').map((token) => token.trim()).filter(Boolean).slice(0, 10);
          targets = ids
            .map((idToken) => state.posts.find((post) => String(post.id) === idToken))
            .filter(Boolean);
        } else if (spec) {
          const single = state.posts.find((post) => String(post.id) === spec)
            || state.posts[parseInt(spec, 10) - 1];
          if (single) targets = [single];
        } else {
          targets = state.posts.length ? [state.posts[0]] : [];
        }

        if (!targets.length) {
          setHint(UI_TEXT.POST_NOT_FOUND);
          setPrompt('>>');
          return true;
        }

        const [first, ...rest] = targets;
        state._continuousRead = {
          boardId: state.board.id,
          queue: rest.map((post) => post.id)
        };
        await showPostView(state.board.id, first.id);
        setHint(rest.length
          ? `연속읽기(${targets.length}건): [엔터] 다음 글 · 다른 명령 입력 시 종료`
          : '연속읽기: [엔터] 다음 글 · 다른 명령 입력 시 종료');
        return true;
      }

      const byPostId = state.posts.find((post) => String(post.id) === rawCmd);
      if (byPostId) { await showPostView(state.board.id, byPostId.id); return true; }

      const n = parseInt(rawCmd, 10);
      if (n >= 1 && state.posts[n - 1]) { await showPostView(state.board.id, state.posts[n - 1].id); return true; }

      return false;
    }

    return false;
  };
}
