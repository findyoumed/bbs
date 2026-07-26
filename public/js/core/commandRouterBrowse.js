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
    const byPostId = posts.find((post) => String((post?.localId ?? post?.id) || '').trim() === value);
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
      postId: post.localId ?? post.id,
      postTitle: post.title || '',
      page: state.page,
      menuPath: state.boardMenuPath,
      menuTitle: state.boardMenuTitle,
      searchParams: { ...(state.searchParams || {}) },
      returnScreen: 'post-list'
    };
    setHint(`${UI_TEXT.POST_DELETE_TARGET}: ${post.title || (post.localId ?? post.id)}`);
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
      // [LOG_ID: 20260727_0500] PT 출력이 페이지네이션을 지원하게 되면서, F는 다음 페이지로
      // 넘기고 그 외 키만 원래대로 목록으로 돌아간다(마지막 페이지에서는 F도 목록으로 감).
      const pageNo = state._ptPageNo || 1;
      const pageCount = state._ptPageCount || 1;
      if (cmd === 'F' && pageNo < pageCount && typeof showPtResult === 'function') {
        await showPtResult(pageNo + 1);
        return true;
      }
      await showPostList(state.board.id, state.page, {
        menuPath: state.boardMenuPath,
        menuTitle: state.boardMenuTitle,
        searchParams: state.searchParams
      });
      return true;
    }

    if (s === 'main') {
      // [LOG_ID: 20260723_2350] [LOG_ID: 20260720_1740]에서 도입된 나우누리 전용 번호 하드코딩
      // (1→guide, 11→memo, 12→top, 13→chat, 16→pds)이 이후 메뉴 구조 개편(hanulso.mnu 재편)과
      // 어긋난 채 방치돼 있었다 — 실제 door는 guide=1, memo=4, chat=6, pds=8, weather=11인데
      // 이 하드코딩은 옛 배치를 그대로 가정해, 지금은 날씨(11)인 자리를 여전히 편지함으로
      // 잘못 처리하고 있었다(사용자 보고: "11. 날씨" 클릭 시 "편지함은 로그인 후 사용하실 수
      // 있습니다" 노출 — 콘솔 로그로 재현: Command 11 dispatch 후에도 화면이 안 바뀜). 1번만
      // 우연히 현재 door와 일치해 정상으로 보였을 뿐이다. 아래 동적 해석
      // (resolveMenuNodeTarget → executeMenuNodeAction)이 실제 메뉴 트리(door) 기준으로 이미
      // 모든 번호를 올바르게 처리하므로, 어긋난 하드코딩 전체를 제거한다 — 게스트 편지함 접근
      // 차단 등 기존 동작은 각 화면 함수(예: showMemoList의 ensureMemoAccess)가 이미 자체적으로
      // 처리하므로 유지된다.
      const num = String(rawCmd || '').trim();
      // 나우누리 테마 활성화 상태에서, 실제 메뉴에 없는 번호는 '준비 중인 서비스' 안내를 출력한다.
      if (state.theme === 'nownuri' && /^\d+$/.test(num)) {
        const visibleForNownuri = Array.isArray(state.boardMenuEntries) && state.boardMenuEntries.length
          ? state.boardMenuEntries
          : getMenuChildren(getMenuNodeByKey('top') || state.menuTree);
        if (!resolveMenuNodeTarget(rawCmd, visibleForNownuri)) {
          setHint('준비 중인 서비스입니다.');
          setPrompt('선택 >>');
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
      // [LOG_ID: 20260720_2035] 가이드 서브메뉴 번호 가로채기 (테마 종속 해제, 실제 메뉴 항목 우선 처리로 회귀 수정)
      // b18bb2c에서 테마 조건(state.theme === 'nownuri')이 빠지면서, 실제 항목이 있는
      // 1~8번(공지사항~이용 현황)까지 실제 메뉴 해석 전에 전부 "준비 중"으로 가로채던 회귀 버그.
      // 실제 메뉴 해석을 먼저 시도하고, 매칭되는 항목이 없을 때만 안내 문구를 보여준다.
      if (state.boardMenuPath === 'guide') {
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
          const guideNode = resolveMenuNodeTarget(rawCmd, state.boardMenuEntries);
          if (guideNode && await executeMenuNodeAction(guideNode, state.boardMenuPath, state.boardMenuTitle)) {
            return true;
          }
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
        const post = findPostByNumberToken(String(cmd || '').trim());
        state._pendingDownloadPrompt = false;
        setPrompt('선택 >>');
        if (post) {
          await startPdsDownloadSequence(post);
        } else {
          setHint('잘못된 번호입니다.');
        }
        return true;
      }

      // [LOG_ID: 20260713_1120] PDS 자료 올리기(UP) 커맨드 및 얼라이어스 (UL, UPLOAD, PUT)
      if (cmd === 'UP' || cmd === 'UL' || cmd === 'UPLOAD' || cmd === 'PUT') {
        const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
        if (isPds) {
          showPostWrite('create');
          return true;
        }
      }

      // [LOG_ID: 20260719_1010] PDS 내 검색 (S, SEARCH, FIND) 명령어 및 얼라이어스 구현
      const isPds = state.board?.id === 'pds' || state.board?.boardId === 'pds' || String(state.boardMenuTitle).includes('자료실');
      if (isPds) {
        if (cmd === 'S' || cmd === 'SEARCH' || cmd === 'FIND') {
          state._pendingSearch = {
            type: 'lt',
            boardId: state.board.id,
            menuPath: state.boardMenuPath,
            menuTitle: state.boardMenuTitle
          };
          setHint('자료실 파일명(제목) 검색어를 입력해 주십시오.');
          setPrompt('검색어 >>');
          return true;
        }
        const pdsSearchMatch = cmd.match(/^(?:S|SEARCH|FIND)\s+(.+)$/i);
        if (pdsSearchMatch) {
          await showPostList(state.board.id, 1, {
            menuPath: state.boardMenuPath,
            menuTitle: state.boardMenuTitle,
            searchParams: { lt: pdsSearchMatch[1].trim() }
          });
          return true;
        }
      }

      // [LOG_ID: 20260722_3300] 글 목록에 표시되는 "번호" 열은 localId/id다(ansiBoardBuilders.js).
      // 예전 DN 구현은 이를 배열 인덱스로 오인해 첫 페이지가 아니거나 정렬이 내림차순일 때
      // 엉뚱한 글을 내려받는 버그가 있었다 — PR 명령과 동일하게 localId/id로 먼저 찾고,
      // 못 찾으면 인덱스로 폴백한다.
      function findPostByNumberToken(token) {
        return state.posts?.find((post) => String(post.localId ?? post.id) === token)
          || state.posts?.[parseInt(token, 10) - 1]
          || null;
      }

      // [LOG_ID: 20260713_1120] PDS 자료 내려받기(DN [번호]) 커맨드 및 얼라이어스 (DL, DOWNLOAD, TR, GET)
      // [LOG_ID: 20260722_3300] 하이텔 책(길라잡이 p.128) 실측: "DN 번호" 외에
      // "DN 번호1, 번호2..."(나열, 최대 10건)와 "DN 번호1-번호2"(범위)도 지원해야 한다 —
      // PR 명령의 파서(그림 8.9와 동일 페이지)와 동일한 문법·큐 방식을 재사용한다.
      const dnMatch = cmd.match(/^(?:DN|DL|DOWNLOAD|TR|GET)(?:\s+([\d,\s-]+))?$/i);
      if (dnMatch) {
        if (!isPds) {
          return false;
        }

        const spec = String(dnMatch[1] || '').trim();
        if (!spec) {
          state._pendingDownloadPrompt = true;
          setHint('다운로드할 글 번호를 입력해 주십시오.');
          setPrompt('글 번호 >>');
          return true;
        }

        let targets = [];
        const rangeMatch = spec.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          const low = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          const high = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
          targets = (state.posts || [])
            .filter((post) => { const id = parseInt(post.localId ?? post.id, 10); return id >= low && id <= high; })
            .sort((left, right) => parseInt(left.localId ?? left.id, 10) - parseInt(right.localId ?? right.id, 10))
            .slice(0, 10);
        } else if (spec.includes(',')) {
          const tokens = spec.split(',').map((token) => token.trim()).filter(Boolean).slice(0, 10);
          targets = tokens.map((token) => findPostByNumberToken(token)).filter(Boolean);
        } else {
          const single = findPostByNumberToken(spec);
          if (single) targets = [single];
        }

        if (!targets.length) {
          setHint('존재하지 않는 번호입니다.');
          setPrompt('선택 >>');
          return true;
        }

        const [first, ...rest] = targets;
        state._downloadQueue = {
          boardId: state.board.id,
          queue: rest.map((post) => post.localId ?? post.id)
        };
        await startPdsDownloadSequence(first);
        return true;
      }

      async function startPdsDownloadSequence(post) {
        setHint('첨부파일 정보를 확인하는 중입니다..');
        try {
          const attachments = await apiFetch(`/api/boards/${state.board.id}/posts/${post.localId ?? post.id}/attachments`);
          if (Array.isArray(attachments) && attachments.length > 0) {
            const file = attachments[0];
            state._pendingDownload = {
              boardId: state.board.id,
              postId: post.localId ?? post.id,
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
            const idx = posts.findIndex((p) => Number(p.localId ?? p.id) === targetPostId);
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

      // [LOG_ID: 20260719_1010] 검색어와 함께 직접 검색 명령어 (LT [query], GL [query], SUBJ [query], LI [query], GA [query], BODY [query]) 실행
      const directSearchMatch = cmd.match(/^(LT|GL|SUBJ|LI|GA|BODY)\s+(.+)$/i);
      if (directSearchMatch) {
        const keyword = directSearchMatch[2].trim();
        const cmdType = directSearchMatch[1].toUpperCase();
        const type = (cmdType === 'GL' || cmdType === 'SUBJ' || cmdType === 'LT') ? 'lt' : (cmdType === 'GA' || cmdType === 'BODY') ? 'lc' : 'li';
        
        await showPostList(state.board.id, 1, {
          menuPath: state.boardMenuPath,
          menuTitle: state.boardMenuTitle,
          searchParams: { [type]: keyword }
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
            .filter((post) => { const id = parseInt(post.localId ?? post.id, 10); return id >= low && id <= high; })
            .sort((left, right) => parseInt(left.localId ?? left.id, 10) - parseInt(right.localId ?? right.id, 10))
            .slice(0, 10);
        } else if (spec.includes(',')) {
          const ids = spec.split(',').map((token) => token.trim()).filter(Boolean).slice(0, 10);
          targets = ids
            .map((idToken) => state.posts.find((post) => String(post.localId ?? post.id) === idToken))
            .filter(Boolean);
        } else if (spec) {
          const single = state.posts.find((post) => String(post.localId ?? post.id) === spec)
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

        // [LOG_ID: 20260726_1800] PDS(자료실)처럼 여러 물리 게시판을 하나로 병합해 보여주는
        // 가상 게시판은 local_id가 하위 게시판별로 독립 채번돼 서로 다른 하위 게시판에서
        // local_id가 우연히 같은 글이 동시에 존재할 수 있다(실제 PDS 데이터에서 확인). 목록에
        // 이미 로드된 글 객체는 자신의 실제 하위 게시판 id(post.boardId)를 갖고 있으므로,
        // 이를 그대로 넘기면 병합 별칭("pds")으로 다시 찾을 때 생기는 모호성을 피해 정확히
        // 그 글을 연다. 별칭으로만 조회 가능한 경로(서버 이전/다음글 탐색 등)는
        // fetchPostByLocalId의 서버측 완화(최근 글 우선)로 최소한 조회 실패는 막는다.
        const [first, ...rest] = targets;
        state._continuousRead = {
          boardId: state.board.id,
          queue: rest.map((post) => ({ localId: post.localId ?? post.id, boardId: post.boardId || state.board.id }))
        };
        await showPostView(first.boardId || state.board.id, first.localId ?? first.id);
        setHint(rest.length
          ? `연속읽기(${targets.length}건): [엔터] 다음 글 · 다른 명령 입력 시 종료`
          : '연속읽기: [엔터] 다음 글 · 다른 명령 입력 시 종료');
        return true;
      }

      const byPostId = state.posts.find((post) => String(post.localId ?? post.id) === rawCmd);
      if (byPostId) { await showPostView(byPostId.boardId || state.board.id, byPostId.localId ?? byPostId.id); return true; }

      const n = parseInt(rawCmd, 10);
      if (n >= 1 && state.posts[n - 1]) {
        const target = state.posts[n - 1];
        await showPostView(target.boardId || state.board.id, target.localId ?? target.id);
        return true;
      }

      return false;
    }

    return false;
  };
}
